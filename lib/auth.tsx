// lib/auth.tsx
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { JWTPayload, getMembershipStatus, type MembershipResp, ApiError } from './api';

const MEMBERSHIP_THROTTLE_MS = 30_000;

/** Dev-only logger helpers */
const log = (...args: any[]) => { if (__DEV__) console.log(...args); };
const safe = (t: string | null) => (t ? `${t.slice(0, 6)}…` : null);

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
  log('[auth] provider mounted');

  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [lastMembershipCheckAt, setLastMembershipCheckAt] = useState<number | undefined>(undefined);

  // guards / refs
  const mountedRef = useRef(true);
  const lastCheckedTokenRef = useRef<string | null>(null);
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const lastMembershipCheckRef = useRef<number>(0);
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      inFlightAbortRef.current?.abort();
    };
  }, []);

  // Restore from SecureStore on app start
  useEffect(() => {
    (async () => {
      log('[auth] restore start');
      try {
        const [t, rt, email, name] = await Promise.all([
          SecureStore.getItemAsync('jwt'),
          SecureStore.getItemAsync('refresh_token'),
          SecureStore.getItemAsync('user_email'),
          SecureStore.getItemAsync('user_display_name'),
        ]);
        if (!mountedRef.current) return;

        log('[auth] restore fetched', { jwt: !!t, rt: !!rt, email: !!email, name: !!name });
        if (t) setToken(t);
        if (rt) setRefreshToken(rt);
        if (email && name) setProfile({ user_email: email, user_display_name: name });
      } catch (e) {
        log('[auth] restore failed:', e);
      } finally {
        if (mountedRef.current) {
          setReady(true);
          log('[auth] restore done → ready=true');
        }
      }
    })();
  }, []);

  // Membership checker
  const refreshMembership = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;

      if (!token) {
        log('[auth] refreshMembership: no token → reset flags');
        setIsMember(null);
        setLastMembershipCheckAt(undefined);
        return;
      }

      const now = Date.now();
      if (!force && now - lastMembershipCheckRef.current < MEMBERSHIP_THROTTLE_MS) {
        log('[auth] refreshMembership: throttled');
        return;
      }
      lastMembershipCheckRef.current = now;

      inFlightAbortRef.current?.abort();
      const ac = new AbortController();
      inFlightAbortRef.current = ac;

      setCheckingMembership(true);
      lastCheckedTokenRef.current = token;

      log('[auth] refreshMembership: start', { token: safe(token), force });

      try {
        const res: MembershipResp = await getMembershipStatus(token, ac.signal);
        if (!mountedRef.current) return;

        // Ignore if token changed mid-flight
        if (lastCheckedTokenRef.current !== token) {
          log('[auth] refreshMembership: token changed mid-flight; ignoring');
          return;
        }

        setIsMember(!!res.is_member);
        setLastMembershipCheckAt(Date.now());
        log('[auth] refreshMembership: success', { is_member: !!res.is_member });
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (e?.name === 'AbortError') {
          log('[auth] refreshMembership: aborted');
          return;
        }

        if (e instanceof ApiError && e.status === 401) {
          log('[auth] refreshMembership: 401 (token invalid for membership endpoint)');
          // token might be expired/invalid for that endpoint
          setIsMember(null);
        } else {
          log('[auth] refreshMembership: error', e);
        }
      } finally {
        if (mountedRef.current) {
          setCheckingMembership(false);
          log('[auth] refreshMembership: end');
        }
      }
    },
    [token]
  );

  // Keep a stable ref to the function used by effects/callbacks
  const refreshRef = useRef(refreshMembership);
  useEffect(() => {
    refreshRef.current = refreshMembership;
  }, [refreshMembership]);

  // React to token changes (only when it actually changes)
  useEffect(() => {
    if (!ready) return;

    if (lastTokenRef.current === token) return; // no real change
    log('[auth] token changed', { from: safe(lastTokenRef.current), to: safe(token) });
    lastTokenRef.current = token;

    if (token) {
      log('[auth] token present → force membership check');
      void refreshRef.current({ force: true });
    } else {
      log('[auth] token cleared → reset membership + abort inflight');
      setIsMember(null);
      setLastMembershipCheckAt(undefined);
      inFlightAbortRef.current?.abort();
    }
  }, [ready, token]);

  // Login setter (can accept refresh_token from custom login)
  const setAuth = useCallback(
    async (payload: JWTPayload & { refresh_token?: string }) => {
      log('[auth] setAuth called', {
        hasToken: !!payload.token,
        hasRefresh: !!payload.refresh_token,
        email: payload.user_email,
      });

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

      await refreshRef.current({ force: true });
    },
    []
  );

  // Logout
  const clearAuth = useCallback(async () => {
    log('[auth] clearAuth called');

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

  // Lightweight watchers (excellent for spotting churn)
  useEffect(() => {
    if (ready) {
      log('[auth] state snapshot →', {
        ready,
        token: !!token,
        isMember,
        checking: checkingMembership,
        lastCheckAt: lastMembershipCheckAt,
      });
    }
  }, [ready, token, isMember, checkingMembership, lastMembershipCheckAt]);

  useEffect(() => {
    log('[auth] profile changed:', profile ? profile.user_email : null);
  }, [profile]);

  const value = useMemo<AuthContextType>(
    () => ({
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
    }),
    [
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
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);