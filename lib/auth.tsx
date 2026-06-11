// lib/auth.tsx
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  getMembershipStatus,
  getCurrentMember,
  validateJwtToken,
  refreshCoralToken,
  ApiError,
} from './api';
import type { 
  JWTPayload, 
  MembershipResponse, 
  UserProfile, 
  AuthContextState 
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
  userId: null,
  profile: null,
  isMember: null,
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
      setIsMember(null);
      return;
    }

    setCheckingMembership(true);
    try {
      const res: MembershipResponse = await getMembershipStatus(activeToken);
      setIsMember(!!res.is_member);
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

          const res: MembershipResponse = await getMembershipStatus(activeToken);
          setIsMember(!!res.is_member);
          setLastMembershipCheckAt(Date.now());
          return;
        } catch (refreshError) {
          setToken(null);
          setRefreshToken(null);
          setUserId(null);
          setProfile(null);
          setIsMember(null);
          setLastMembershipCheckAt(undefined);
          await clearStoredAuth();
          return;
        }
      }

      if (e instanceof ApiError && e.status === 401) {
        setIsMember(null);
        return;
      }
    } finally {
      setCheckingMembership(false);
    }
  }, [token, refreshToken]);

  // When token is restored or changes, check membership (once ready)
  useEffect(() => {
    if (!ready) return;
    if (token) {
      // fire and forget; UI can use checkingMembership
      refreshMembership();
    } else {
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
      const res: MembershipResponse = await getMembershipStatus(payload.token);
      setIsMember(!!res.is_member);
      setLastMembershipCheckAt(Date.now());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
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
        isMember,
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
