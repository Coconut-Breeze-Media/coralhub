
// app/(auth)/sign-in.tsx
import { useState } from 'react';
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';   
import { wpLogin } from '../lib/api';   

export const options = { headerShown: false }; // ← hide the default header

const PRIMARY = '#0077b6';
const FIELD_GAP = 16;   // gap between stacked fields
const SECTION_GAP = 28; // gap before the primary button

export default function SignInScreen() {
  const { setAuth, ready } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    try {
      if (!username || !password) {
        Alert.alert('Missing info', 'Please enter both username/email and password.');
        return;
      }
      setBusy(true);
      const payload = await wpLogin(username.trim(), password);
      await setAuth(payload);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Preparing…</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Log In</Text>

        {/* form stack with consistent gaps */}
        <View style={styles.stack}>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            editable={!busy}
            placeholder="Email / Username"
            placeholderTextColor="#999"
          />

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!busy}
              placeholder="Password"
              placeholderTextColor="#999"
            />
            <Pressable onPress={() => setShowPassword((p) => !p)} disabled={busy}>
              <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>

        {/* same vertical offset after fields → button */}
        <TouchableOpacity
          disabled={busy}
          onPress={handleLogin}
          style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
        >
          <Text style={styles.primaryBtnText}>{busy ? 'Logging in…' : 'Log In'}</Text>
        </TouchableOpacity>

        {/* links */}
        <View style={styles.helperRow}>
          <Pressable
            onPress={() =>
              Linking.openURL('https://www.thecoralreefresearchhub.com/wp-login.php?action=lostpassword')
            }
            disabled={busy}
          >
            <Text style={styles.helperLink}>Forgot password?</Text>
          </Pressable>
        </View>

        <View style={styles.helperRow}>
          <Text style={{ color: '#444' }}>
            Not a member yet?{' '}
            <Text
              style={{ color: PRIMARY, fontWeight: '700' }}
              onPress={() => router.push('/sign-up')}  // routes to app/(auth)/sign-up.tsx
            >
              Register now
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  container: {
    flex: 1, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 20,
  },
  title: {
    fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 24,
  },
  stack: {
    gap: FIELD_GAP,
  },
  input: {
    width: '85%',
    alignSelf: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  passwordRow: {
    width: '85%',
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 12,
  },
  showText: {
    color: PRIMARY, fontWeight: '600',
  },
  primaryBtn: {
    width: '85%',
    alignSelf: 'center',
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: SECTION_GAP,
  },
  primaryBtnText: {
    color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16,
  },
  helperRow: {
    marginTop: 16, alignItems: 'center',
  },
  helperLink: {
    color: PRIMARY, fontWeight: '600',
  },
});