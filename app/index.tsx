// app/index.tsx
import React from 'react';
import { SafeAreaView, View, Text, Image, TouchableOpacity } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../lib/auth';

const PRIMARY = '#0077b6';

export default function WelcomeScreen() {
  const { ready, token } = useAuth();

  // Skip landing if already authenticated
  if (ready && token) return <Redirect href="/(tabs)" />;
  if (!ready) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Image
          source={require('../assets/Logo_Text_transparent.png')}
          style={{ width: 120, height: 120, resizeMode: 'contain', transform: [{ scale: 2.5 }] }}
        />

        <Text style={{ fontSize: 20, fontWeight: '800', color: '#000', textAlign: 'center' }}>
          GET CONNECTED
        </Text>

        <Text
          style={{
            fontSize: 16,
            color: '#333',
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: '90%',
          }}
        >
          A career development and global professional networking hub for coral
          researchers, early career scientists and other reef specialists.
        </Text>

        {/* Log in → use the grouped path */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          style={{ backgroundColor: PRIMARY, padding: 14, borderRadius: 12, width: '85%' }}
          accessibilityLabel="Log in"
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>LOG IN</Text>
        </TouchableOpacity>

        {/* Register */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/membership-levels')}
          style={{ borderWidth: 2, borderColor: PRIMARY, padding: 14, borderRadius: 12, width: '85%' }}
          accessibilityLabel="Not a member? Register now"
        >
          <Text style={{ color: PRIMARY, textAlign: 'center', fontWeight: '700' }}>
            NOT A MEMBER? REGISTER NOW!
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}