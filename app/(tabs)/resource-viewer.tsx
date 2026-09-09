// app/resource-viewer.tsx
/**
 * In-app browser for premium resources.
 *
 * Renders the gated website page inside a WebView instead of handing the URL
 * to the system browser (`Linking.openURL`). Two things this fixes:
 *
 *  1. Embedded experience — the user stays inside the app.
 *  2. Stays logged in — for HTML pages we exchange the app's JWT for a one-time
 *     SSO login URL (`getAppLoginLink`) and load THAT as the entry point. The
 *     resulting WordPress auth cookie is kept by the WebView (sharedCookies on
 *     iOS, thirdPartyCookies on Android), so every subsequent navigation within
 *     the site stays authenticated.
 *
 * PDFs are public assets and need no SSO. Android's WebView can't render PDFs
 * inline, so on Android we embed them through Google's gview wrapper; iOS
 * renders them natively.
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
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useAuth } from '../lib/auth';
import { getAppLoginLink } from '../lib/api';

const PRIMARY = '#0077b6';
const MUTED = '#6b7280';

// Same-origin host the embedded session is allowed to roam. Anything off this
// host (other than the Google PDF viewer) is opened in the system browser
// instead of trapping the user in-app.
const WP_HOST = hostOf(process.env.EXPO_PUBLIC_WP_URL ?? '');
const GVIEW_HOST = 'docs.google.com';

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return /\.pdf($|\?)/i.test(url);
  }
}

// Android WebView won't render PDFs inline — wrap them in Google's gview.
function pdfEntryUrl(url: string): string {
  if (Platform.OS === 'android') {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function ResourceViewerScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const { token } = useAuth();

  // The URL we actually load: SSO entry point for gated pages, gview for PDFs
  // on Android, else the target URL directly.
  const [entryUrl, setEntryUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [failed, setFailed] = useState(false);
  // Guards against re-running the SSO exchange on every re-render / retry churn.
  const resolvedFor = useRef<string | null>(null);

  const resolveEntry = useCallback(async () => {
    if (!url) {
      setFailed(true);
      setPreparing(false);
      return;
    }
    setPreparing(true);
    setFailed(false);
    try {
      if (isPdfUrl(url)) {
        // Public file — no SSO needed.
        setEntryUrl(pdfEntryUrl(url));
      } else if (token) {
        const { url: ssoUrl } = await getAppLoginLink(token, url);
        setEntryUrl(ssoUrl);
      } else {
        setEntryUrl(url);
      }
      resolvedFor.current = url;
    } catch (e) {
      // SSO exchange failed — fall back to the raw page so the resource is
      // still reachable (user may have to log in once on the site).
      setEntryUrl(url);
      resolvedFor.current = url;
    } finally {
      setPreparing(false);
    }
  }, [url, token]);

  useEffect(() => {
    if (url && resolvedFor.current !== url) resolveEntry();
  }, [url, resolveEntry]);

  // Keep same-host (and the Google PDF viewer) navigation inside the WebView;
  // punt external links (other domains, mailto:, tel:) to the OS so we don't
  // trap the user.
  const onShouldStartLoadWithRequest = useCallback((req: WebViewNavigation) => {
    const target = req.url;
    if (
      target.startsWith('about:') ||
      target.startsWith('data:') ||
      target.startsWith('blob:')
    ) {
      return true;
    }
    if (/^https?:\/\//i.test(target)) {
      const host = hostOf(target);
      const allowed = !WP_HOST || host === WP_HOST || host === GVIEW_HOST;
      if (allowed) return true;
      Linking.openURL(target).catch(() => {});
      return false;
    }
    // mailto:, tel:, custom schemes → hand off to the OS.
    Linking.openURL(target).catch(() => {});
    return false;
  }, []);

  const headerTitle = title || 'Resource';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerTitle, headerShown: true }} />

      {preparing || !entryUrl ? (
        failed ? (
          <ErrorState onRetry={resolveEntry} message="This resource is unavailable." />
        ) : (
          <Centered>
            <ActivityIndicator color={PRIMARY} />
            <Text style={styles.muted}>Opening…</Text>
          </Centered>
        )
      ) : (
        <WebView
          source={{ uri: entryUrl }}
          // Persist the WP auth cookie across navigations (this is what keeps
          // the user logged in inside the embed).
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          incognito={false}
          originWhitelist={['https://*', 'http://*']}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          startInLoadingState
          renderLoading={() => (
            <Centered>
              <ActivityIndicator color={PRIMARY} />
            </Centered>
          )}
          renderError={() => (
            <ErrorState onRetry={resolveEntry} message="Couldn't load this resource." />
          )}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
        />
      )}
    </SafeAreaView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function ErrorState({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 8,
  },
  muted: { color: MUTED, marginTop: 8 },
  errorText: { color: '#b91c1c', marginBottom: 12, paddingHorizontal: 24, textAlign: 'center' },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: PRIMARY, fontWeight: '700' },
});
