// app/password-reset.tsx
/**
 * Native "Forgot password" screen, styled to match sign-in.
 *
 * The member enters their email or username and the site emails them a reset
 * link (POST /coral/v1/auth/lost-password, coral-social-api plugin). The
 * endpoint always answers with the same generic message, so this screen never
 * reveals whether an account exists.
 *
 * Only if that endpoint is missing (plugin not deployed) do we offer the
 * website's own reset page, opened in the system browser where it renders
 * correctly — never an embedded WebView.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, requestPasswordReset } from '../lib/api';
import { PASSWORD_RESET_URL } from '../lib/config';
import { ROUTES } from '../constants/navigation';

export const options = { headerShown: false };

const PRIMARY = '#0077b6';
const NAVY = '#002f6c';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const ERROR = '#dc2626';

const GENERIC_MESSAGE =
  'If an account exists for that email or username, we’ve sent a link to reset your password.';

export default function PasswordResetScreen() {
  const insets = useSafeAreaInsets();
  const [userLogin, setUserLogin] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [websiteFallback, setWebsiteFallback] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function backToSignIn() {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace(ROUTES.SIGN_IN);
    }
  }

  async function handleSubmit() {
    if (busy) return;
    setError(null);
    setWebsiteFallback(false);

    const value = userLogin.trim();
    if (!value) {
      setError('Please enter your email or username.');
      return;
    }

    try {
      setBusy(true);
      await requestPasswordReset(value);
      setSentTo(value);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (e instanceof ApiError && (e.status === 404 || e.status === 401 || e.status === 403)) {
        // Endpoint not available on the site yet.
        setError('Password reset isn’t available in the app right now.');
        setWebsiteFallback(true);
      } else {
        setError('Something went wrong. Check your connection and try again.');
        setWebsiteFallback(true);
      }
    } finally {
      setBusy(false);
    }
  }

  function openWebsiteReset() {
    Linking.openURL(PASSWORD_RESET_URL).catch(() => {
      setError('Could not open the website. Please try again later.');
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={backToSignIn}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
          >
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {sentTo ? (
            <View style={styles.card}>
              <View style={styles.successBadge}>
                <Ionicons name="mail-open-outline" size={40} color={PRIMARY} />
              </View>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.helper}>{GENERIC_MESSAGE}</Text>
              <Text style={styles.helperSmall}>
                Open the link in the email to choose a new password, then come back and sign in.
                It can take a few minutes to arrive — check your spam or junk folder too.
              </Text>

              <Pressable
                onPress={backToSignIn}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Back to sign in</Text>
              </Pressable>

              <Pressable
                onPress={() => setSentTo(null)}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={styles.linkBtn}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>Didn’t get it? Send again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.brand}>
                <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="cover" />
                <Text style={styles.wordmark}>CoRR Hub</Text>
              </View>
              <Text style={styles.title}>Reset your password</Text>
              <Text style={styles.helper}>
                Enter the email or username on your account and we’ll email you a link to reset
                your password.
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>Email or username</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focused && styles.inputWrapFocused,
                    !!error && styles.inputWrapError,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    value={userLogin}
                    onChangeText={(v) => {
                      setUserLogin(v);
                      if (error) setError(null);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="username"
                    keyboardType="email-address"
                    returnKeyType="send"
                    onSubmitEditing={handleSubmit}
                    editable={!busy}
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    autoFocus
                  />
                </View>
                {!!error && <Text style={styles.fieldError}>{error}</Text>}
              </View>

              <Pressable
                disabled={busy}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && !busy && styles.primaryBtnPressed,
                  busy && styles.primaryBtnBusy,
                ]}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send reset link</Text>
                )}
              </Pressable>

              {websiteFallback && (
                <Pressable
                  onPress={openWebsiteReset}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  style={styles.linkBtn}
                  accessibilityRole="link"
                >
                  <Text style={styles.linkText}>Reset on the website instead</Text>
                </Pressable>
              )}

              <Pressable
                onPress={backToSignIn}
                disabled={busy}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={styles.linkBtn}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>Back to sign in</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#fff' },

  topBar: {
    height: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'stretch',
    marginTop: 8,
  },

  brand: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    marginBottom: 16,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 0.3,
  },
  successBadge: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: NAVY,
    textAlign: 'center',
    marginBottom: 8,
  },
  helper: {
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  helperSmall: {
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  field: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  inputWrapFocused: { borderColor: PRIMARY },
  inputWrapError: { borderColor: ERROR },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: TEXT,
    paddingVertical: 0,
  },
  fieldError: {
    marginTop: 6,
    fontSize: 13,
    color: ERROR,
  },

  primaryBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnPressed: { backgroundColor: '#006aa3' },
  primaryBtnBusy: { opacity: 0.8 },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  linkBtn: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 4,
  },
  linkText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
});
