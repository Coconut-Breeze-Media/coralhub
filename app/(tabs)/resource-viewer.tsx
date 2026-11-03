// app/resource-viewer.tsx
/**
 * In-app browser for website resources (premium resources, search results).
 *
 * HTML pages on the website need the member's WordPress login cookie, which
 * the WebView does not have — the app only holds a JWT. Before loading the
 * page we exchange the JWT for a one-time sign-in URL
 * (POST /coral/v1/auth/web-session, coral-membership plugin). Loading that
 * URL sets the WordPress cookie and lands on the resource, so the member
 * never sees the website login form. The WebView keeps the cookie
 * (sharedCookies on iOS, thirdPartyCookies on Android), so following links
 * to other pages on the site stays signed in.
 *
 * If the endpoint is missing (plugin not deployed) or fails, the viewer falls
 * back to the website's /login/?redirect_to=<resource> page.
 *
 * PDFs are public assets. Android's WebView can't render PDFs inline, so on
 * Android we embed them through Google's gview wrapper; iOS renders them
 * natively.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { brandHeaderTitle } from '../../components/AppHeader';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { SITE_URL } from '../../lib/config';
import { ApiError, getWebSessionUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  hostOf,
  isWebSessionHandoffUrl,
  needsWebSession,
  resourceViewerEntry,
  shouldKeepResourceNavigation,
} from '../../lib/resourceNavigation';

const PRIMARY = '#0077b6';
const MUTED = '#6b7280';

const WP_HOST = hostOf(SITE_URL);

type EntryState =
  | { status: 'idle' }
  | { status: 'signing-in' }
  | { status: 'ready'; uri: string }
  | { status: 'handoff-failed'; message: string };

export default function ResourceViewerScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const { token } = useAuth();
  const [entry, setEntry] = useState<EntryState>({ status: 'idle' });
  const [failed, setFailed] = useState(false);
  // Bumping this re-runs the sign-in exchange. The one-time URL is consumed
  // by the first load, so a retry must always fetch a fresh one.
  const [attempt, setAttempt] = useState(0);
  // Read the JWT through a ref: a background token refresh must not reload
  // the page the member is reading.
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const hasToken = !!token;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const token = tokenRef.current;

    if (!url) {
      setEntry({ status: 'idle' });
      return;
    }

    // PDFs, off-site links, or no app session: nothing to hand off.
    if (!token || !needsWebSession(url, SITE_URL)) {
      setEntry({ status: 'ready', uri: resourceViewerEntry(url, SITE_URL, Platform.OS) });
      return;
    }

    setEntry({ status: 'signing-in' });
    getWebSessionUrl(token, url)
      .then((res) => {
        if (cancelled) return;
        if (!res?.url || !isWebSessionHandoffUrl(res.url, SITE_URL)) {
          setEntry({
            status: 'handoff-failed',
            message: "We couldn't sign you in to this resource.",
          });
          return;
        }
        setEntry({ status: 'ready', uri: res.url });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Route not on the site yet (older coral-membership plugin): use the
        // website login page so the resource still opens.
        if (error instanceof ApiError && error.status === 404) {
          setEntry({ status: 'ready', uri: resourceViewerEntry(url, SITE_URL, Platform.OS) });
          return;
        }
        const message =
          error instanceof ApiError && error.status === 429
            ? 'Too many attempts. Please wait a moment and try again.'
            : error instanceof ApiError && (error.status === 401 || error.status === 403)
              ? 'Your session has expired. Please sign in to the app again.'
              : "We couldn't sign you in to this resource. Check your connection and try again.";
        setEntry({ status: 'handoff-failed', message });
      });

    return () => {
      cancelled = true;
    };
  }, [url, hasToken, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  const openWithWebsiteLogin = useCallback(() => {
    if (!url) return;
    setFailed(false);
    setEntry({ status: 'ready', uri: resourceViewerEntry(url, SITE_URL, Platform.OS) });
  }, [url]);

  // Keep the Coral Hub page, its login form, reCAPTCHA, and the PDF viewer
  // inside this WebView. Only a real top-level hop to some other site goes
  // to the OS.
  const onShouldStartLoadWithRequest = useCallback((req: WebViewNavigation) => {
    const isTopFrame = (req as WebViewNavigation & { isTopFrame?: boolean }).isTopFrame;
    if (shouldKeepResourceNavigation(req.url, WP_HOST, isTopFrame)) {
      return true;
    }
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  const navigation = useNavigation();
  const headerTitle = title || 'Resource';
  useEffect(() => {
    navigation.setOptions({ headerTitle: brandHeaderTitle(headerTitle) });
  }, [navigation, headerTitle]);

  let body: React.ReactNode;
  if (!url) {
    body = <ErrorState message="This resource is unavailable." />;
  } else if (entry.status === 'idle' || entry.status === 'signing-in') {
    body = (
      <Centered>
        <ActivityIndicator color={PRIMARY} />
        <Text style={styles.muted}>Signing you in…</Text>
      </Centered>
    );
  } else if (entry.status === 'handoff-failed') {
    body = (
      <ErrorState
        message={entry.message}
        onRetry={retry}
        secondaryLabel="Sign in on the website instead"
        onSecondary={openWithWebsiteLogin}
      />
    );
  } else if (failed) {
    body = <ErrorState message="Couldn't load this resource." onRetry={retry} />;
  } else {
    body = (
      <WebView
        key={`${entry.uri}:${attempt}`}
        source={{ uri: entry.uri }}
        // Persist the WP auth cookie across navigations (this is what keeps
        // the user logged in inside the embed after the one-time sign-in).
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        incognito={false}
        originWhitelist={['https://*', 'http://*']}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onError={() => setFailed(true)}
        startInLoadingState
        renderLoading={() => (
          <Centered>
            <ActivityIndicator color={PRIMARY} />
            <Text style={styles.muted}>Opening…</Text>
          </Centered>
        )}
        renderError={() => <ErrorState message="Couldn't load this resource." onRetry={retry} />}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {body}
    </SafeAreaView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function ErrorState({
  onRetry,
  message,
  secondaryLabel,
  onSecondary,
}: {
  onRetry?: () => void;
  message: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
      {onSecondary && secondaryLabel ? (
        <TouchableOpacity onPress={onSecondary} style={styles.retryBtn} accessibilityRole="button">
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 8,
  },
  muted: { color: MUTED, marginTop: 8 },
  errorText: { color: '#b91c1c', marginBottom: 12, paddingHorizontal: 24, textAlign: 'center' },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: PRIMARY, fontWeight: '700' },
  secondaryText: { color: MUTED, fontWeight: '600', textDecorationLine: 'underline' },
});
