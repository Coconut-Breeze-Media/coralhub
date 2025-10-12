import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type Attachment = { uri: string; type: 'photo'|'video'|'file'|'audio' };

export default function AttachmentsTray({
  items,
  onRemove,
}: {
  items: Attachment[];
  onRemove: (uri: string) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
      {items.map((att) => (
        <TouchableOpacity
          key={att.uri}
          onPress={() => onRemove(att.uri)}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 6, paddingHorizontal: 10, marginRight: 8, marginTop: 8,
            borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc',
          }}
        >
          <Ionicons name="close-circle-outline" size={16} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 12, color: '#334155' }}>{att.type}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}