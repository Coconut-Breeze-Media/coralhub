// app/components/RequireAuth.tsx
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../lib/auth';

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
      <Text style={{ position: 'absolute', opacity: 0 }}>Loading</Text>
    </View>
  );
}

type RequireAuthProps = {
  children: React.ReactNode;
  to?: string;                 // sign-in route
  requireMember?: boolean;
  membershipRoute?: string;    // where to send non-members
};

// Remove group segments like "/(auth)" and trailing slashes.
// Also collapse multiple slashes.
function normalizePath(p: string) {
  if (!p) return '/';
  return p
    .replace(/\/\([^/]+\)(?=\/|$)/g, '') // strip group segments /(group)
    .replace(/\/+$/g, '')                // trailing slash
    .replace(/\/{2,}/g, '/') || '/';
}

export default function RequireAuth({
  children,
  to = '/(auth)/sign-in',
  requireMember = false,
  membershipRoute = '/resources',
}: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, token, isMember, checkingMembership } = useAuth();

  // Prevent repeated replace() calls for the same destination during a single transition
  const redirectingToRef = useRef<string | null>(null);

  const hereNorm  = normalizePath(pathname);
  const toNorm    = normalizePath(to);
  const paywallNorm = normalizePath(membershipRoute);

  const onSignIn    = hereNorm === toNorm;
  const onPaywall   = hereNorm === paywallNorm;

  useEffect(() => {
    if (!ready) return;

    // If a redirect is still in flight, don't attempt another
    if (redirectingToRef.current) return;

    // Not logged in → go to sign-in (avoid loop if already there)
    if (!token) {
      if (!onSignIn) {
        redirectingToRef.current = to;
        router.replace({ pathname: to, params: { returnTo: pathname } });
      }
      return;
    }

    // Logged in, but membership required and missing → go to membershipRoute
    if (requireMember && isMember === false && !onPaywall) {
      redirectingToRef.current = membershipRoute;
      router.replace(membershipRoute);
      return;
    }
  }, [
    ready, token, requireMember, isMember,
    onSignIn, onPaywall, to, membershipRoute, pathname, router
  ]);

  // Clear the "redirect in progress" once we actually land somewhere else
  useEffect(() => {
    if (redirectingToRef.current && hereNorm === normalizePath(redirectingToRef.current)) {
      // we're now on the destination; clear flag
      redirectingToRef.current = null;
    }
  }, [hereNorm]);

  // Loading while restoring auth or while checking membership for protected screens
  if (!ready || (requireMember && token && (isMember === null || checkingMembership))) {
    return <Loading />;
  }

  // If not logged in and we are (or will be) on sign-in, render nothing
  if (!token) return onSignIn ? null : <Loading />;

  // If membership required but missing, render nothing on the paywall page
  if (requireMember && isMember === false) return onPaywall ? null : <Loading />;

  return <>{children}</>;
}