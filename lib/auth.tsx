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
  registerAuthSession,
  ApiError,
} from './api';
import { isTransientError } from './authErrors';
import { queryClient } from './queryClient';
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
    if (typeof localStorage === 'undefined') return null;
    // The refresh token is memory-only on web. Drop any copy a previous build
    // left in localStorage so it is not readable by page scripts.
    if (key === 'refresh_token') {
      localStorage.removeItem(key);
      return null;
    }
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (key === 'refresh_token') return;
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
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
  // Refs stay in sync with state so the 401 interceptor can read and rotate
  // tokens without waiting for a React render.
  const tokenRef = React.useRef<string | null>(null);
  const refreshRef = React.useRef<string | null>(null);

  const applySession = useCallback((next: { token: string; refreshToken: string } | null) => {
    if (!next) {
      tokenRef.current = null;
      refreshRef.current = null;
      setToken(null);
      setRefreshToken(null);
      setUserId(null);
      setProfile(null);
      setMembership(null);
      setIsMember(null);
      setLastMembershipCheckAt(undefined);
      void clearStoredAuth();
      queryClient.clear();
      return;
    }

    tokenRef.current = next.token;
    refreshRef.current = next.refreshToken;
    setToken(next.token);
    setRefreshToken(next.refreshToken);
    void setStorageItem(STORAGE_KEYS.jwt, next.token);
    void setStorageItem(STORAGE_KEYS.refreshToken, next.refreshToken);
  }, []);

  useEffect(() => {
    registerAuthSession({
      getRefreshToken: () => refreshRef.current,
      onSessionChange: applySession,
    });
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let t: string | null = null;
      let rt: string | null = null;
      let email: string | null = null;
      let name: string | null = null;
      let uid: string | null = null;

      const restore = (access: string, refresh: string | null) => {
        if (cancelled) return;
        tokenRef.current = access;
        refreshRef.current = refresh;
        setToken(access);
        setRefreshToken(refresh);
        if (uid) setUserId(parseInt(uid, 10));
        setProfile(
          email && name
            ? {
                user_email: email,
                user_display_name: name,
                user_id: uid ? parseInt(uid, 10) : undefined,
              }
            : null
        );
      };

      try {
        t = await getStorageItem(STORAGE_KEYS.jwt);
        rt = await getStorageItem(STORAGE_KEYS.refreshToken);
        email = await getStorageItem(STORAGE_KEYS.userEmail);
        name = await getStorageItem(STORAGE_KEYS.userDisplayName);
        uid = await getStorageItem(STORAGE_KEYS.userId);

        if (t) {
          let isTokenValid = false;
          let keepStoredSession = false;

          try {
            isTokenValid = await validateJwtToken(t);
          } catch (error) {
            // Airplane mode and 5xx must not delete the saved login.
            if (isTransientError(error)) keepStoredSession = true;
            else throw error;
          }

          if (!isTokenValid && !keepStoredSession && rt) {
            try {
              const refreshed = await refreshCoralToken(rt);
              t = refreshed.token;
              rt = refreshed.refresh_token ?? rt;
              await setStorageItem(STORAGE_KEYS.jwt, t);
              await setStorageItem(STORAGE_KEYS.refreshToken, rt);
              isTokenValid = true;
            } catch (error) {
              if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                await clearStoredAuth();
                return;
              }
              keepStoredSession = true;
            }
          }

          if (!isTokenValid && !keepStoredSession) {
            await clearStoredAuth();
            return;
          }

          restore(t, rt);
        }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await clearStoredAuth();
          if (!cancelled) {
            tokenRef.current = null;
            refreshRef.current = null;
            setToken(null);
            setRefreshToken(null);
            setUserId(null);
            setProfile(null);
            setMembership(null);
            setIsMember(null);
          }
        } else if (t) {
          restore(t, rt);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
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
    (resourceKey: string) => {
      if (!membership) return false;
      // Server list may be missing, empty, or stale (older plugin version):
      // always union it with the client catalog for the known tier.
      const server = membership.allowed_resources ?? [];
      if (server.includes(resourceKey)) return true;
      return allowedResourcesForTier(membership.tier ?? 'none').includes(resourceKey);
    },
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
    tokenRef.current = payload.token;
    refreshRef.current = payload.refresh_token ?? null;
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
    tokenRef.current = null;
    refreshRef.current = null;
    setToken(null);
    setRefreshToken(null);
    setUserId(null);
    setProfile(null);
    setMembership(null);
    setIsMember(null);
    setLastMembershipCheckAt(undefined);

    await clearStoredAuth();

    // Query caches are keyed by resource, not by account. Without this, the next
    // user to sign in on this device is served the previous user's cached
    // conversations, profile and feeds until each key goes stale.
    queryClient.clear();
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
