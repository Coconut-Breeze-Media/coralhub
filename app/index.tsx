// app/index.tsx
// import { SafeAreaView, View, Text, Image, TouchableOpacity, Linking } from 'react-native';
// import { Redirect, router } from 'expo-router';
// import { useAuth } from '../lib/auth';

// const PRIMARY = '#0077b6';

// export default function WelcomeScreen() {
//   const { ready, token } = useAuth();

//   // If we restored auth and already have a token, skip welcome
//   if (ready && token) return <Redirect href="/(tabs)" />;

//   return (
    // <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    //   <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
    //     {/* Logo */}
    //     <Image
    //       source={require('../assets/icon.png')}
    //       style={{ width: 160, height: 160, resizeMode: 'contain', marginBottom: 8 }}
    //     />

    //     {/* Headline */}
    //     <Text style={{ fontSize: 28, fontWeight: '800', color: '#000', textAlign: 'center' }}>
    //       GET CONNECTED
    //     </Text>

    //     {/* Subhead */}
    //     <Text style={{ fontSize: 16, color: '#333', textAlign: 'center', lineHeight: 22 }}>
    //       A career development and global professional networking hub for coral researchers,
    //       early career scientists and other reef specialists.
    //     </Text>

    //     {/* Buttons */}
    //     <TouchableOpacity
    //       onPress={() => router.push('/sign-in')}
    //       style={{ backgroundColor: PRIMARY, padding: 14, borderRadius: 10, width: '85%', marginTop: 16 }}
    //     >
    //       <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>LOG IN</Text>
    //     </TouchableOpacity>

    //     <TouchableOpacity
    //       onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_JOIN_URL ?? 'https://www.thecoralreefresearchhub.com')}
    //       style={{ borderWidth: 2, borderColor: PRIMARY, padding: 14, borderRadius: 10, width: '85%' }}
    //     >
    //       <Text style={{ color: PRIMARY, textAlign: 'center', fontWeight: '700' }}>
    //         NOT A MEMBER? REGISTER NOW!
    //       </Text>
    //     </TouchableOpacity>
    //   </View>
    // </SafeAreaView>

//   );
// }


// app/index.tsx
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
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
          gap: 16, // ← unified spacing between ALL children
        }}
      >
        {/* Logo */}
        <Image
          source={require('../assets/icon.png')}
          style={{ width: 120, height: 120, resizeMode: 'contain' }}
        />

        {/* Site title */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#0ea5e9',
            textAlign: 'center',
          }}
        >
          THE{'\n'}CORAL REEF{'\n'}RESEARCH HUB
        </Text>

        {/* Headline */}
        <Text
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#000',
            textAlign: 'center',
          }}
        >
          GET CONNECTED
        </Text>

        {/* Subhead */}
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

        {/* Log in */}
        <TouchableOpacity
          onPress={() => router.push('/sign-in')}
          style={{
            backgroundColor: PRIMARY,
            padding: 14,
            borderRadius: 12,
            width: '85%',
          }}
          accessibilityLabel="Log in"
        >
          <Text
            style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}
          >
            LOG IN
          </Text>
        </TouchableOpacity>

        {/* Register */}
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              process.env.EXPO_PUBLIC_JOIN_URL ??
                'https://www.thecoralreefresearchhub.com/membership-account/membership-levels/'
            )
          }
          style={{
            borderWidth: 2,
            borderColor: PRIMARY,
            padding: 14,
            borderRadius: 12,
            width: '85%',
          }}
          accessibilityLabel="Not a member? Register now"
        >
          <Text
            style={{ color: PRIMARY, textAlign: 'center', fontWeight: '700' }}
          >
            NOT A MEMBER? REGISTER NOW!
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}