// lib/auth.tsx
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { JWTPayload, getMembershipStatus, type MembershipResp, ApiError } from './api';

type AuthContextType = {
  token: string | null;
  profile: Pick<JWTPayload, 'user_email' | 'user_display_name'> | null;
  isMember: boolean | null;        // null = not checked yet
  refreshMembership: () => Promise<void>;
  setAuth: (payload: JWTPayload) => Promise<void>;
  clearAuth: () => Promise<void>;
  ready: boolean;                  // storage restored + initial membership (if token) attempted
  checkingMembership: boolean;     // useful for UI spinners
  lastMembershipCheckAt?: number;  // Date.now()
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  profile: null,
  isMember: null,
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
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
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
        const t = await SecureStore.getItemAsync('jwt');
        const email = await SecureStore.getItemAsync('user_email');
        const name = await SecureStore.getItemAsync('user_display_name');
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
      setIsMember(null);
      return;
    }
    setCheckingMembership(true);
    try {
      const res: MembershipResp = await getMembershipStatus(token);
      setIsMember(!!res.is_member);
      setLastMembershipCheckAt(Date.now());
    } catch (e) {
      // if unauthorized, clear member flag but keep token as-is (UI can react)
      if (e instanceof ApiError && e.status === 401) {
        setIsMember(null);
      } else {
        // network/other errors: keep previous value, optionally log
        console.warn('Membership check failed:', e);
      }
    } finally {
      setCheckingMembership(false);
    }
  }, [token]);

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
    setProfile({ user_email: payload.user_email, user_display_name: payload.user_display_name });

    await SecureStore.setItemAsync('jwt', payload.token);
    await SecureStore.setItemAsync('user_email', payload.user_email);
    await SecureStore.setItemAsync('user_display_name', payload.user_display_name);

    // Immediately check membership after login
    await refreshMembership();
  };

  // Logout
  const clearAuth = async () => {
    setToken(null);
    setProfile(null);
    setIsMember(null);
    setLastMembershipCheckAt(undefined);

    await SecureStore.deleteItemAsync('jwt');
    await SecureStore.deleteItemAsync('user_email');
    await SecureStore.deleteItemAsync('user_display_name');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
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