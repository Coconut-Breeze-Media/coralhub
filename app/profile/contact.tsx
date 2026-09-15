// app/profile/contact.tsx

import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';

const HUB_URL = 'https://www.thecoralreefresearchhub.com';
const PRIMARY = '#2563eb';

export default function ContactScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View
        style={{
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingHorizontal: 16,
          paddingTop: 60,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 }}>Contact Us</Text>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#eff6ff',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="mail-outline" size={28} color={PRIMARY} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
            Get in touch
          </Text>
          <Text style={{ fontSize: 15, color: '#4b5563', lineHeight: 22, marginBottom: 20 }}>
            For general enquiries and support, please visit the Coral Reef Research Hub website.
            We do not offer an in-app contact form.
          </Text>
          <Pressable
            onPress={() => Linking.openURL(HUB_URL)}
            accessibilityRole="link"
            accessibilityLabel="Visit the Coral Reef Research Hub"
            style={({ pressed }) => ({
              height: 50,
              borderRadius: 12,
              backgroundColor: PRIMARY,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="globe-outline" size={20} color="#fff" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Visit the Hub</Text>
            <Ionicons name="open-outline" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
