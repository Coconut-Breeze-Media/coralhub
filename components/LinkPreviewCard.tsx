import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';

const TITLE   = '#111827'; // gray-900
const MUTED   = '#6b7280'; // gray-500
const LINK    = '#2563eb'; // blue-600

export type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  domain?: string;
};

export default function LinkPreviewCard({
  url,
  title,
  imageUrl,
  domain,
}: LinkPreviewData) {
  const open = () => Linking.openURL(url);

  return (

    <TouchableOpacity
      onPress={open}
      activeOpacity={0.85}
      style={{
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 16,
        gap: 10,
      }}
    >
      {!!imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: 160, borderRadius: 6 }}
          resizeMode="cover"
        />
      )}

      {!!title && (
        <Text style={{ fontWeight: '700', color: '#4b5563', fontSize: 16, lineHeight: 22 }}>
          {title}
        </Text>
      )}

      <Text style={{ color: '#059669', fontWeight: '700', marginTop: 2, letterSpacing: 0.4 }}>
        {(domain || url).toUpperCase()}
      </Text>
    </TouchableOpacity>
      );
    }