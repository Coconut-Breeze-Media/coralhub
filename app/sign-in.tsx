// app/sign-in.tsx
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import { useAuth } from '../lib/auth';
import { wpLogin } from '../lib/api';
import { ROUTES } from '../constants/navigation';

export const options = { headerShown: false }; // ← hide the default header

const PRIMARY = '#0077b6';
const NAVY = '#002f6c';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const ERROR = '#dc2626';

type Field = 'username' | 'password';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { setAuth, ready } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace(ROUTES.WELCOME);
    }
  }

  function validate(): boolean {
    const next: Partial<Record<Field, string>> = {};
    if (!username.trim()) next.username = 'Please enter your email or username.';
    if (!password) next.password = 'Please enter your password.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleLogin() {
    if (busy) return;
    setServerError(null);
    if (!validate()) return;

    try {
      setBusy(true);
      const payload = await wpLogin(username.trim(), password);
      await setAuth(payload);
      router.replace('/(tabs)');
    } catch (e: any) {
      setServerError(e?.message ?? 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={PRIMARY} />
        <Text style={styles.loadingText}>Preparing…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
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
          {/* Branding */}
          <View style={styles.brand}>
            <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="cover" />
            <Text style={styles.wordmark}>CoRR Hub</Text>
            <Text style={styles.subtitle}>Welcome back</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email or username</Text>
              <View
                style={[
                  styles.inputWrap,
                  focused === 'username' && styles.inputWrapFocused,
                  !!fieldErrors.username && styles.inputWrapError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(v) => {
                    setUsername(v);
                    if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
                  }}
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  keyboardType="email-address"
                  returnKeyType="next"
                  editable={!busy}
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              {!!fieldErrors.username && <Text style={styles.fieldError}>{fieldErrors.username}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputWrap,
                  focused === 'password' && styles.inputWrapFocused,
                  !!fieldErrors.password && styles.inputWrapError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                  }}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!busy}
                  placeholder="Your password"
                  placeholderTextColor="#9ca3af"
                />
                <Pressable
                  onPress={() => setShowPassword((p) => !p)}
                  disabled={busy}
                  hitSlop={8}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={MUTED}
                  />
                </Pressable>
              </View>
              {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
            </View>

            {!!serverError && (
              <View style={styles.banner} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle-outline" size={18} color={ERROR} />
                <Text style={styles.bannerText}>{serverError}</Text>
              </View>
            )}

            <Pressable
              disabled={busy}
              onPress={handleLogin}
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
                <Text style={styles.primaryBtnText}>Log in</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push(ROUTES.FORGOT_PASSWORD)}
              disabled={busy}
              hitSlop={8}
              style={styles.forgotBtn}
              accessibilityRole="link"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Not a member yet? </Text>
          <Pressable
            onPress={() => router.push(ROUTES.MEMBERSHIP_LEVELS)}
            disabled={busy}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="link"
          >
            <Text style={styles.footerLink}>Register now</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#fff' },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 10, color: MUTED },

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

  brand: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
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
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: MUTED,
  },

  form: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
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
  eyeBtn: {
    paddingLeft: 10,
    height: '100%',
    justifyContent: 'center',
  },
  fieldError: {
    marginTop: 6,
    fontSize: 13,
    color: ERROR,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bannerText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 14,
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

  forgotBtn: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 4,
  },
  forgotText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  footerText: {
    color: MUTED,
    fontSize: 15,
  },
  footerLink: {
    color: PRIMARY,
    fontWeight: '700',
    fontSize: 15,
  },
});
