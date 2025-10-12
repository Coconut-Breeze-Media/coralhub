import React from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';

const BORDER = '#e5e7eb';

export default function LinkModal({
  visible, url, onChange, onDismiss, onConfirm,
}: {
  visible: boolean;
  url: string;
  onChange: (v: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Add a link</Text>
          <TextInput
            value={url}
            onChangeText={onChange}
            placeholder="https://example.org"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10 }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
            <TouchableOpacity onPress={onDismiss} style={{ marginRight: 12 }}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm}>
              <Text style={{ color: '#0077b6', fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}