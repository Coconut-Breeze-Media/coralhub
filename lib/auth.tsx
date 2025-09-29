// lib/auth.tsx
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo, useRef,
} from 'react';
import { JWTPayload, getMembershipStatus, type MembershipResp, ApiError } from './api';

const MEMBERSHIP_THROTTLE_MS = 30_000;

type AuthContextType = {
  token: string | null;
  refreshToken: string | null;
  profile: Pick<JWTPayload, 'user_email' | 'user_display_name'> | null;
  isMember: boolean | null;
  refreshMembership: (opts?: { force?: boolean }) => Promise<void>;
  setAuth: (payload: JWTPayload & { refresh_token?: string }) => Promise<void>;
  clearAuth: () => Promise<void>;
  ready: boolean;
  checkingMembership: boolean;
  lastMembershipCheckAt?: number;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  refreshToken: null,
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
  if (__DEV__) console.log('[auth] provider mounted');

  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [lastMembershipCheckAt, setLastMembershipCheckAt] = useState<number | undefined>(undefined);

  // guards
  const mountedRef = useRef(true);
  const lastCheckedTokenRef = useRef<string | null>(null);
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const lastMembershipCheckRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      inFlightAbortRef.current?.abort();
    };
  }, []);

  // Restore from SecureStore on app start
  useEffect(() => {
    (async () => {
      if (__DEV__) console.log('[auth] restore start');
      try {
        const [t, rt, email, name] = await Promise.all([
          SecureStore.getItemAsync('jwt'),
          SecureStore.getItemAsync('refresh_token'),
          SecureStore.getItemAsync('user_email'),
          SecureStore.getItemAsync('user_display_name'),
        ]);
        if (!mountedRef.current) return;

        if (t) setToken(t);
        if (rt) setRefreshToken(rt);
        if (email && name) setProfile({ user_email: email, user_display_name: name });
      } catch (e) {
        if (__DEV__) console.warn('[auth] restore failed:', e);
      } finally {
        if (mountedRef.current) setReady(true);
      }
    })();
  }, []);

  // membership checker (callable + used internally)
  const refreshMembership = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;

      if (!token) {
        setIsMember(null);
        setLastMembershipCheckAt(undefined);
        return;
      }

      const now = Date.now();
      if (!force && now - lastMembershipCheckRef.current < MEMBERSHIP_THROTTLE_MS) return;
      lastMembershipCheckRef.current = now;

      inFlightAbortRef.current?.abort();
      const ac = new AbortController();
      inFlightAbortRef.current = ac;

      setCheckingMembership(true);
      lastCheckedTokenRef.current = token;

      try {
        const res: MembershipResp = await getMembershipStatus(token, ac.signal);
        if (!mountedRef.current) return;
        if (lastCheckedTokenRef.current !== token) return;

        setIsMember(!!res.is_member);
        setLastMembershipCheckAt(Date.now());
      } catch (e) {
        if (!mountedRef.current) return;
        if ((e as any)?.name === 'AbortError') return;

        if (e instanceof ApiError && e.status === 401) {
          // token invalid for membership route; leave token as-is, unset member flag
          setIsMember(null);
        } else if (__DEV__) {
          console.warn('[auth] membership check failed:', e);
        }
      } finally {
        if (mountedRef.current) setCheckingMembership(false);
      }
    },
    [token]
  );

  // When token is ready/changes, check membership
  useEffect(() => {
    if (!ready) return;
    if (token) {
      void refreshMembership({ force: true });
    } else {
      setIsMember(null);
      setLastMembershipCheckAt(undefined);
      inFlightAbortRef.current?.abort();
    }
  }, [token, ready, refreshMembership]);

  // Login setter (can accept refresh_token from your custom login)
  const setAuth = useCallback(
    async (payload: JWTPayload & { refresh_token?: string }) => {
      setToken(payload.token);
      setProfile({ user_email: payload.user_email, user_display_name: payload.user_display_name });

      const ops = [
        SecureStore.setItemAsync('jwt', payload.token),
        SecureStore.setItemAsync('user_email', payload.user_email),
        SecureStore.setItemAsync('user_display_name', payload.user_display_name),
      ];
      if (payload.refresh_token) {
        setRefreshToken(payload.refresh_token);
        ops.push(SecureStore.setItemAsync('refresh_token', payload.refresh_token));
      }
      await Promise.all(ops);

      await refreshMembership({ force: true });
    },
    [refreshMembership]
  );

  // Logout
  const clearAuth = useCallback(async () => {
    inFlightAbortRef.current?.abort();

    setToken(null);
    setRefreshToken(null);
    setProfile(null);
    setIsMember(null);
    setLastMembershipCheckAt(undefined);

    await Promise.all([
      SecureStore.deleteItemAsync('jwt'),
      SecureStore.deleteItemAsync('refresh_token'),
      SecureStore.deleteItemAsync('user_email'),
      SecureStore.deleteItemAsync('user_display_name'),
    ]);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    token,
    refreshToken,
    profile,
    isMember,
    refreshMembership,
    setAuth,
    clearAuth,
    ready,
    checkingMembership,
    lastMembershipCheckAt,
  }), [
    token,
    refreshToken,
    profile,
    isMember,
    refreshMembership,
    setAuth,
    clearAuth,
    ready,
    checkingMembership,
    lastMembershipCheckAt,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);