// app/forgot-password.tsx
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
  'If an account exists for that email or username, a password reset link has been sent.';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [userLogin, setUserLogin] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace(ROUTES.SIGN_IN);
    }
  }

  async function handleSubmit() {
    if (busy) return;
    setError(null);
    setNote(null);

    const value = userLogin.trim();
    if (!value) {
      setError('Please enter your email or username.');
      return;
    }

    try {
      setBusy(true);
      const res = await requestPasswordReset(value);
      setSentMessage(res?.message || GENERIC_MESSAGE);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404) {
        // Plugin endpoint not deployed yet — fall back to the website flow.
        setNote('Opening the website to reset your password…');
        Linking.openURL(PASSWORD_RESET_URL).catch(() => {
          setNote(null);
          setError('Could not open the website. Please try again later.');
        });
      } else if (e instanceof ApiError && e.status === 429) {
        setError('Too many attempts. Please wait a few minutes.');
      } else {
        setError(e?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
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
          {sentMessage ? (
            <View style={styles.card}>
              <Ionicons name="checkmark-circle" size={72} color={PRIMARY} style={styles.successIcon} />
              <Text style={styles.title}>Check your inbox</Text>
              <Text style={styles.helper}>{sentMessage}</Text>

              <Pressable
                onPress={() => router.replace(ROUTES.SIGN_IN)}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Back to log in</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="cover" />
              <Text style={styles.title}>Reset your password</Text>
              <Text style={styles.helper}>
                Enter the email or username on your account and we&apos;ll send you a reset link.
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
                    autoComplete="username"
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
                {!!note && <Text style={styles.note}>{note}</Text>}
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
    alignItems: 'center',
    marginTop: 8,
  },

  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 20,
  },
  successIcon: { marginBottom: 12 },
  title: {
    fontSize: 24,
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
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  field: { width: '100%', marginBottom: 16 },
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
  note: {
    marginTop: 6,
    fontSize: 13,
    color: MUTED,
  },

  primaryBtn: {
    width: '100%',
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
});
