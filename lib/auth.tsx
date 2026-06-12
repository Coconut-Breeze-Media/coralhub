// lib/auth.tsx
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { getMembershipStatus, getPmproMe, extractPmproLevel, ApiError } from './api';
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


const AuthContext = createContext<AuthContextState>({
  token: null,
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[auth] provider mounted'); 
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<MembershipResponse | null>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [lastMembershipCheckAt, setLastMembershipCheckAt] = useState<number | undefined>(undefined);

  // Restore from SecureStore on app start
  // useEffect(() => {
  //   (async () => {
  //     const t = await SecureStore.getItemAsync('jwt');
  //     const email = await SecureStore.getItemAsync('user_email');
  //     const name = await SecureStore.getItemAsync('user_display_name');

  //     if (t) {
  //       setToken(t);
  //       setProfile(email && name ? { user_email: email, user_display_name: name } : null);
  //     }
  //     setReady(true);
  //   })();
  // }, []);



  useEffect(() => {
    (async () => {
      console.log('[auth] restore start');
      try {
        const t = await getStorageItem('jwt');
        const email = await getStorageItem('user_email');
        const name = await getStorageItem('user_display_name');
        if (t) {
          setToken(t);
          setProfile(email && name ? { user_email: email, user_display_name: name } : null);
        }
      } catch (e) {
        console.warn('Auth restore failed:', e);
      } finally {
        setReady(true); // <-- ensure this always runs
      }
    })();
  }, []);

  // membership checker (callable + used internally)
  const refreshMembership = useCallback(async () => {
    if (!token) {
      setMembership(null);
      setIsMember(null);
      return;
    }
    setCheckingMembership(true);
    try {
      const res: MembershipResponse = await getMembershipStatus(token);

      let full: MembershipResponse = res;
      if (!res.tier) {
        // Legacy server (coral-membership v1.3) only returns { is_member }.
        // Derive the tier from PMPro's built-in /pmpro/v1/me endpoint and
        // compute allowed resources client-side.
        let tier: MembershipTier = res.is_member ? 'monthly' : 'none';
        let levelId: number | null = null;
        let levelName: string | null = null;
        try {
          const me = await getPmproMe(token);
          const lvl = extractPmproLevel(me);
          levelId = lvl.id;
          levelName = lvl.name;
          if (lvl.id != null && LEVEL_ID_TIER_MAP[lvl.id] != null) {
            tier = LEVEL_ID_TIER_MAP[lvl.id];
          } else {
            const byName = tierFromLevelName(lvl.name);
            if (byName) tier = byName;
          }
        } catch (err) {
          // /pmpro/v1/me unavailable or denied — keep the is_member-based
          // tier so paying users aren't locked out of monthly resources.
          console.warn('pmpro/v1/me lookup failed; using is_member fallback:', err);
        }
        full = {
          ...res,
          tier,
          level_id: levelId,
          level_name: levelName,
          allowed_resources: allowedResourcesForTier(tier),
        };
      }

      setMembership(full);
      setIsMember(full.tier !== 'none');
      setLastMembershipCheckAt(Date.now());
    } catch (e) {
      // if unauthorized, clear member flag but keep token as-is (UI can react)
      if (e instanceof ApiError && e.status === 401) {
        setMembership(null);
        setIsMember(null);
      } else {
        // network/other errors: keep previous value, optionally log
        console.warn('Membership check failed:', e);
      }
    } finally {
      setCheckingMembership(false);
    }
  }, [token]);

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
    setProfile({ user_email: payload.user_email, user_display_name: payload.user_display_name });

    await setStorageItem('jwt', payload.token);
    await setStorageItem('user_email', payload.user_email);
    await setStorageItem('user_display_name', payload.user_display_name);

    // Immediately check membership after login
    await refreshMembership();
  };

  // Logout
  const clearAuth = async () => {
    setToken(null);
    setProfile(null);
    setMembership(null);
    setIsMember(null);
    setLastMembershipCheckAt(undefined);

    await deleteStorageItem('jwt');
    await deleteStorageItem('user_email');
    await deleteStorageItem('user_display_name');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
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