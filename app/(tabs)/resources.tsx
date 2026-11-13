import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from 'expo-router';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import BackButton from '../../components/BackButton';
import { ROUTES } from '../../constants/navigation';
import { ApiError, getWebSessionUrl, wpLogin } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { SITE_URL } from '../../lib/config';
import {
  hostOf,
  IN_APP_BROWSER_BOOTSTRAP,
  isWebSessionHandoffUrl,
  needsWebSession,
  premiumResourcesUrl,
  shouldLeaveAppForNavigation,
} from '../../lib/resourceNavigation';

const PRIMARY = '#0077b6';
const NAVY = '#002f6c';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const ERROR = '#dc2626';

const RESOURCES_URL = premiumResourcesUrl(SITE_URL);
const SITE_HOST = hostOf(SITE_URL);

const LEAVE_APP_MESSAGE = 'You are now being redirected outside of the CoRR Hub app.';

type Phase = 'verify' | 'opening' | 'browse';

/**
 * Resources tab.
 *
 * Membership and the resource list live on the website, so the app does not
 * sell or list them. The member confirms the login they already use, then
 * the premium resources page opens in this tab (bottom menu stays). The
 * public site header is hidden. A link that leaves the website opens in the
 * phone's browser after a warning. Back returns to the previous app screen.
 */
export default function ResourcesScreen() {
  const navigation = useNavigation();
  const { profile, setAuth } = useAuth();
  const [phase, setPhase] = useState<Phase>('verify');
  const [username, setUsername] = useState(profile?.user_email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryUrl, setEntryUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerLeft: () => <BackButton fallbackRoute={ROUTES.COMMUNITY} />,
      });
      return () => {
        // Next visit starts at the login check again.
        setPhase('verify');
        setPassword('');
        setError(null);
        setEntryUrl(null);
      };
    }, [navigation])
  );

  const openResources = useCallback(async (sessionToken: string) => {
    setPhase('opening');
    try {
      if (needsWebSession(RESOURCES_URL, SITE_URL)) {
        const session = await getWebSessionUrl(sessionToken, RESOURCES_URL);
        if (session?.url && isWebSessionHandoffUrl(session.url, SITE_URL)) {
          setEntryUrl(session.url);
          setPhase('browse');
          return;
        }
      }
    } catch {
      // The page itself still loads. The website can ask them to sign in there.
    }
    setEntryUrl(RESOURCES_URL);
    setPhase('browse');
  }, []);

  const handleLogin = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed || !password) {
      setError('Enter the email and password for your CoRR Hub membership.');
      return;
    }
    setError(null);
    setPhase('opening');
    try {
      const payload = await wpLogin(trimmed, password);
      await setAuth(payload);
      setPassword('');
      await openResources(payload.token);
    } catch (e) {
      setPhase('verify');
      setError(e instanceof ApiError ? e.message : 'Those login details were not recognised.');
    }
  }, [username, password, setAuth, openResources]);

  const onShouldStartLoadWithRequest = useCallback((req: WebViewNavigation) => {
    const request = req as WebViewNavigation & { isTopFrame?: boolean };
    if (
      !shouldLeaveAppForNavigation(
        request.url,
        SITE_HOST,
        request.isTopFrame,
        request.navigationType
      )
    ) {
      return true;
    }
    Alert.alert('Leaving CoRR Hub', LEAVE_APP_MESSAGE, [
      { text: 'Stay here', style: 'cancel' },
      { text: 'Continue', onPress: () => Linking.openURL(request.url).catch(() => {}) },
    ]);
    return false;
  }, []);

  if (phase === 'browse' && entryUrl) {
    return (
      <View style={styles.screen}>
        <WebView
          source={{ uri: entryUrl }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          originWhitelist={['https://*', 'http://*']}
          injectedJavaScriptBeforeContentLoaded={IN_APP_BROWSER_BOOTSTRAP}
          injectedJavaScript={IN_APP_BROWSER_BOOTSTRAP}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.centered}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          )}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures={false}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.kicker}>Resources</Text>
        <Text style={styles.title}>Verify your login details to view our resources list</Text>
        <Text style={styles.body}>
          Logging in opens the CoRR Hub resources inside the app, on the premium resources
          page. Your membership on the website decides which resources you can open, and you
          can upgrade it there. A link that leaves the CoRR Hub website opens in your browser,
          outside the app.
        </Text>

        <Text style={styles.label}>Email or username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          placeholder="name@email.com"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          editable={phase !== 'opening'}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            style={[styles.input, styles.passwordInput]}
            editable={phase !== 'opening'}
            onSubmitEditing={handleLogin}
          />
          <Pressable
            onPress={() => setShowPassword((value) => !value)}
            hitSlop={8}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            style={styles.eye}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleLogin}
          disabled={phase === 'opening'}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, phase === 'opening' && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Log in and open resources"
        >
          {phase === 'opening' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </Pressable>

        <Text style={styles.note}>
          Logging in takes you to the premium resources page. The app menu stays at the bottom,
          and Back returns you to the last page you were viewing in the app.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  form: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  kicker: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: NAVY,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  body: {
    marginTop: 12,
    color: TEXT,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    marginTop: 18,
    marginBottom: 6,
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: TEXT,
    backgroundColor: '#fff',
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 44 },
  eye: { position: 'absolute', right: 12, top: 12 },
  error: { marginTop: 12, color: ERROR, fontSize: 14, lineHeight: 20 },
  button: {
    marginTop: 20,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.7 },
  note: { marginTop: 14, color: MUTED, fontSize: 13, lineHeight: 19 },
  centered: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
