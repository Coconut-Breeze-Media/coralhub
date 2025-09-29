// app/components/RequireAuth.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../lib/auth';

type RequireAuthProps = {
  children: React.ReactNode;
  /** Where to send unauthenticated users */
  to?: string; // default: '/sign-in'
  /** If true, also require active membership */
  requireMember?: boolean;
  /** Where to send non-members, if requireMember=true */
  membershipRoute?: string; // default: '/resources' or '/membership'
};

function Loading() {
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <ActivityIndicator />
      <Text style={{ position: 'absolute', opacity: 0 }}>Loading</Text>
    </View>
  );
}

export default function RequireAuth({
  children,
  to = '/sign-in',
  requireMember = false,
  membershipRoute = '/resources', // change if you have a dedicated paywall: '/membership'
}: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    ready,
    token,
    isMember,
    checkingMembership,
  } = useAuth();

  // Navigate (replace) once we know our auth state
  useEffect(() => {
    if (!ready) return;

    // Not logged in → go to sign-in and preserve returnTo
    if (!token) {
      router.replace({ pathname: to, params: { returnTo: pathname } });
      return;
    }

    // Logged in but membership required and missing → go to membership route
    if (requireMember && isMember === false) {
      router.replace(membershipRoute);
    }
  }, [ready, token, requireMember, isMember, pathname, to, membershipRoute, router]);

  // Loading states:
  // - still restoring auth from storage
  // - or (when requireMember) we’re checking membership after a token exists
  if (!ready || (requireMember && token && (isMember === null || checkingMembership))) {
    return <Loading />;
  }

  // If we’ve queued a redirect, render nothing to avoid flicker
  if (!token) return null;
  if (requireMember && isMember === false) return null;

  return <>{children}</>;
}