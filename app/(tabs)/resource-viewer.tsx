// app/resource-viewer.tsx
/**
 * In-app browser for premium resources.
 *
 * HTML resources open the website's own login page, with redirect_to set to
 * the resource. The member signs in with their website account and lands on
 * that page. The WebView keeps the WordPress cookie (sharedCookies on iOS,
 * thirdPartyCookies on Android), so a later resource opens already signed in
 * until the cookie expires.
 *
 * PDFs are public assets. Android's WebView can't render PDFs inline, so on
 * Android we embed them through Google's gview wrapper; iOS renders them
 * natively.
 */
import React, { useCallback, useEffect, useState } from 'react';
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
import {
  hostOf,
  resourceViewerEntry,
  shouldKeepResourceNavigation,
} from '../../lib/resourceNavigation';

const PRIMARY = '#0077b6';
const MUTED = '#6b7280';

const WP_HOST = hostOf(SITE_URL);

export default function ResourceViewerScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const entryUrl = url ? resourceViewerEntry(url, SITE_URL, Platform.OS) : null;

  useEffect(() => {
    setFailed(false);
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!entryUrl ? (
        <ErrorState message="This resource is unavailable." />
      ) : failed ? (
        <ErrorState
          message="Couldn't load this resource."
          onRetry={() => {
            setFailed(false);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : (
        <WebView
          key={`${entryUrl}:${reloadKey}`}
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
          onError={() => setFailed(true)}
          startInLoadingState
          renderLoading={() => (
            <Centered>
              <ActivityIndicator color={PRIMARY} />
              <Text style={styles.muted}>Opening…</Text>
            </Centered>
          )}
          renderError={() => (
            <ErrorState
              message="Couldn't load this resource."
              onRetry={() => {
                setFailed(false);
                setReloadKey((key) => key + 1);
              }}
            />
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

function ErrorState({ onRetry, message }: { onRetry?: () => void; message: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
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
