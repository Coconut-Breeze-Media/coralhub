// lib/auth.tsx
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  getMembershipStatus,
  getCurrentMember,
  validateJwtToken,
  refreshCoralToken,
  getPmproMe,
  extractPmproLevel,
  ApiError,
} from './api';
import {
  LEVEL_ID_TIER_MAP,
  tierFromLevelName,
  allowedResourcesForTier,
} from '../constants/premiumResources';
import type {
  JWTPayload,
  MembershipResponse,
  MembershipTier,
  UserProfile,
  AuthContextState,
} from '../types';

// Helper functions to handle storage on web vs native
async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function deleteStorageItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Fetch membership and resolve the user's tier + allowed resources.
 * New server (coral-membership v1.4+) returns tier/allowed_resources directly;
 * on the legacy server (only { is_member }) the tier is derived from PMPro's
 * built-in /pmpro/v1/me endpoint, falling back to the level-name prefix, then
 * to is_member ? 'monthly' : 'none'. Shared by every membership-check path so
 * token refreshes and fresh logins never leave membership stale.
 */
async function deriveMembership(activeToken: string): Promise<MembershipResponse> {
  const res: MembershipResponse = await getMembershipStatus(activeToken);
  if (res.tier) {
    return res;
  }

  let tier: MembershipTier = res.is_member ? 'monthly' : 'none';
  let levelId: number | null = null;
  let levelName: string | null = null;
  try {
    const me = await getPmproMe(activeToken);
    const lvl = extractPmproLevel(me);
    levelId = lvl.id;
    levelName = lvl.name;
    if (lvl.id != null && LEVEL_ID_TIER_MAP[lvl.id] != null) {
      tier = LEVEL_ID_TIER_MAP[lvl.id];
    } else {
      const byName = tierFromLevelName(lvl.name);
      if (byName) tier = byName;
    }
  } catch {
    // /pmpro/v1/me unavailable or denied — keep the is_member-based tier so
    // paying users aren't locked out of monthly resources.
  }

  return {
    ...res,
    tier,
    level_id: levelId,
    level_name: levelName,
    allowed_resources: allowedResourcesForTier(tier),
  };
}

const AuthContext = createContext<AuthContextState>({
  token: null,
  userId: null,
  profile: null,
  membership: null,
  isMember: null,
  canAccess: () => false,
  refreshMembership: async () => {},
  setAuth: async () => {},
  clearAuth: async () => {},
  ready: false,
  checkingMembership: false,
  lastMembershipCheckAt: undefined,
});

const STORAGE_KEYS = {
  jwt: 'jwt',
  refreshToken: 'refresh_token',
  userEmail: 'user_email',
  userDisplayName: 'user_display_name',
  userId: 'user_id',
} as const;

async function clearStoredAuth(): Promise<void> {
  await Promise.all([
    deleteStorageItem(STORAGE_KEYS.jwt),
    deleteStorageItem(STORAGE_KEYS.refreshToken),
    deleteStorageItem(STORAGE_KEYS.userEmail),
    deleteStorageItem(STORAGE_KEYS.userDisplayName),
    deleteStorageItem(STORAGE_KEYS.userId),
  ]);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<MembershipResponse | null>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [lastMembershipCheckAt, setLastMembershipCheckAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        let t = await getStorageItem(STORAGE_KEYS.jwt);
        let rt = await getStorageItem(STORAGE_KEYS.refreshToken);
        const email = await getStorageItem(STORAGE_KEYS.userEmail);
        const name = await getStorageItem(STORAGE_KEYS.userDisplayName);
        const uid = await getStorageItem(STORAGE_KEYS.userId);

        if (t) {
          const isTokenValid = await validateJwtToken(t);

          if (!isTokenValid && rt) {
            const refreshed = await refreshCoralToken(rt);
            t = refreshed.token;
            rt = refreshed.refresh_token ?? rt;

            await setStorageItem(STORAGE_KEYS.jwt, t);
            await setStorageItem(STORAGE_KEYS.refreshToken, rt);
          }

          if (!isTokenValid && !rt) {
            await clearStoredAuth();
            return;
          }

          setToken(t);
          setRefreshToken(rt);
          if (uid) {
            setUserId(parseInt(uid, 10));
          }
          setProfile(email && name ? { user_email: email, user_display_name: name, user_id: uid ? parseInt(uid, 10) : undefined } : null);
        }
      } catch (e) {
        await clearStoredAuth();
        setToken(null);
        setRefreshToken(null);
        setUserId(null);
        setProfile(null);
        setMembership(null);
        setIsMember(null);
      } finally {
        setReady(true); // <-- ensure this always runs
      }
    })();
  }, []);

  // membership checker (callable + used internally)
  const refreshMembership = useCallback(async () => {
    let activeToken = token;

    if (!activeToken) {
      setMembership(null);
      setIsMember(null);
      return;
    }

    setCheckingMembership(true);
    try {
      const full = await deriveMembership(activeToken);
      setMembership(full);
      setIsMember(full.tier !== 'none');
      setLastMembershipCheckAt(Date.now());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && refreshToken) {
        try {
          const refreshed = await refreshCoralToken(refreshToken);
          activeToken = refreshed.token;
          const nextRefreshToken = refreshed.refresh_token ?? refreshToken;

          setToken(activeToken);
          setRefreshToken(nextRefreshToken);
          await setStorageItem(STORAGE_KEYS.jwt, activeToken);
          await setStorageItem(STORAGE_KEYS.refreshToken, nextRefreshToken);

          const full = await deriveMembership(activeToken);
          setMembership(full);
          setIsMember(full.tier !== 'none');
          setLastMembershipCheckAt(Date.now());
          return;
        } catch (refreshError) {
          setToken(null);
          setRefreshToken(null);
          setUserId(null);
          setProfile(null);
          setMembership(null);
          setIsMember(null);
          setLastMembershipCheckAt(undefined);
          await clearStoredAuth();
          return;
        }
      }

      if (e instanceof ApiError && e.status === 401) {
        setMembership(null);
        setIsMember(null);
        return;
      }
    } finally {
      setCheckingMembership(false);
    }
  }, [token, refreshToken]);

  // Whether the current tier grants access to a given resource key.
  const canAccess = useCallback(
    (resourceKey: string) => !!membership?.allowed_resources?.includes(resourceKey),
    [membership]
  );

  // When token is restored or changes, check membership (once ready)
  useEffect(() => {
    if (!ready) return;
    if (token) {
      // fire and forget; UI can use checkingMembership
      refreshMembership();
    } else {
      setMembership(null);
      setIsMember(null);
    }
  }, [token, ready, refreshMembership]);

  // Login setter
  const setAuth = async (payload: JWTPayload) => {
    setToken(payload.token);
    setRefreshToken(payload.refresh_token ?? null);
    setProfile({ user_email: payload.user_email, user_display_name: payload.user_display_name });

    await setStorageItem(STORAGE_KEYS.jwt, payload.token);
    await setStorageItem(STORAGE_KEYS.userEmail, payload.user_email);
    await setStorageItem(STORAGE_KEYS.userDisplayName, payload.user_display_name);
    if (payload.refresh_token) {
      await setStorageItem(STORAGE_KEYS.refreshToken, payload.refresh_token);
    } else {
      await deleteStorageItem(STORAGE_KEYS.refreshToken);
    }

    // Fetch user ID from BuddyPress
    try {
      const member = await getCurrentMember(payload.token);
      if (member?.id) {
        setUserId(member.id);
        await setStorageItem(STORAGE_KEYS.userId, member.id.toString());
        setProfile(prev => ({ ...prev!, user_id: member.id }));
      }
    } catch (e) {
    }

    // Immediately check membership with the newly issued token.
    setCheckingMembership(true);
    try {
      const full = await deriveMembership(payload.token);
      setMembership(full);
      setIsMember(full.tier !== 'none');
      setLastMembershipCheckAt(Date.now());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMembership(null);
        setIsMember(null);
      } else {
      }
    } finally {
      setCheckingMembership(false);
    }
  };

  // Logout
  const clearAuth = async () => {
    setToken(null);
    setRefreshToken(null);
    setUserId(null);
    setProfile(null);
    setMembership(null);
    setIsMember(null);
    setLastMembershipCheckAt(undefined);

    await clearStoredAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        profile,
        membership,
        isMember,
        canAccess,
        refreshMembership,
        setAuth,
        clearAuth,
        ready,
        checkingMembership,
        lastMembershipCheckAt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
