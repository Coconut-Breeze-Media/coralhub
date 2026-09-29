// components/AppHeader.tsx
/**
 * Compact brand lockup for React Navigation's `headerTitle`.
 */
import React from 'react';
import { Image, Text, View } from 'react-native';

type AppHeaderProps = {
  subtitle?: string;
};

export default function AppHeader({ subtitle }: AppHeaderProps) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image
          source={require('../assets/icon.png')}
          style={{ width: 28, height: 28, borderRadius: 8 }}
        />
        <Text style={{ fontSize: 17, fontWeight: '800', color: '#002f6c', letterSpacing: 0.3 }}>
          CoRR Hub
        </Text>
      </View>
      {subtitle ? (
        <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export const brandHeaderTitle = (subtitle?: string) => () => <AppHeader subtitle={subtitle} />;
