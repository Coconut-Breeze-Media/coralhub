// components/LikeStrip.tsx
import React from 'react';
import { View, Text, Image } from 'react-native';
import type { BPMember } from '../lib/api';

const BORDER = '#e5e7eb';
const MUTED  = '#6b7280';

export default function LikeStrip({
  likers,
  summaryText,
}: {
  likers: BPMember[];
  summaryText: string;
}) {
  const show = (likers || []).slice(0, 3); // show up to 3 avatars
  return (
    <View style={{ paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row' }}>
        {show.map(m => (
          <Image
            key={m.id}
            source={{ uri: m.avatar_urls?.thumb || m.avatar_urls?.full }}
            style={{ width: 28, height: 28, borderRadius: 14, marginRight: -6, borderWidth: 2, borderColor: '#fff', backgroundColor: '#ddd' }}
          />
        ))}
      </View>
      {!!summaryText && (
        <Text style={{ color: MUTED }} numberOfLines={1}>
          {summaryText}
        </Text>
      )}
    </View>
  );
}