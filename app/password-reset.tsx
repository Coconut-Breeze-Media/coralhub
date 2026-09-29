import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { PASSWORD_RESET_URL, SITE_URL } from '../lib/config';

const PRIMARY = '#0077b6';

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

const SITE_HOST = hostOf(SITE_URL);
// WordPress' recovery form is protected by Google reCAPTCHA. Its challenge
// navigates to these hosts before returning to the Coral Hub form, so they
// must stay in the embedded browser too.
const RECAPTCHA_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'recaptcha.net',
  'www.recaptcha.net',
]);

/**
 * Keeps the WordPress password-reset flow in the application. The reset email
 * itself remains handled by the mail client, but the request and all website
 * pages on the Coral Hub domain are displayed in this WebView rather than
 * Safari/Chrome.
 */
export default function PasswordResetScreen() {
  const [failed, setFailed] = useState(false);

  const onShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
    const target = request.url;

    if (target.startsWith('about:') || target.startsWith('data:') || target.startsWith('blob:')) {
      return true;
    }

    if (/^https?:\/\//i.test(target)) {
      const host = hostOf(target);
      if (host === SITE_HOST || RECAPTCHA_HOSTS.has(host)) {
        return true;
      }
    }

    // Email, telephone, and third-party links must use the operating system.
    Linking.openURL(target).catch(() => {});
    return false;
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Reset password' }} />
      {failed ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>We couldn’t open the password reset page.</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: PASSWORD_RESET_URL }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onError={() => setFailed(true)}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.centered}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          )}
          // iOS supports the native back/forward swipe while staying embedded.
          allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  errorText: { color: '#b91c1c', textAlign: 'center' },
});
