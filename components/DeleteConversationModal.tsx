import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DeleteConversationModalProps {
  visible: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConversationModal({
  visible,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteConversationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isDeleting ? undefined : onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 20,
            backgroundColor: '#ffffff',
            padding: 22,
            shadowColor: '#0f172a',
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#fef2f2',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#dc2626" />
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#0f172a',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            Delete conversation?
          </Text>

          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: '#475569',
              textAlign: 'center',
              marginBottom: 22,
            }}
          >
            Delete this conversation? This will remove it from your inbox. Are you
            sure you want to continue?
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={onCancel}
              disabled={isDeleting}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                backgroundColor: '#ffffff',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a' }}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={isDeleting}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: 12,
                backgroundColor: '#dc2626',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isDeleting ? 0.85 : 1,
              }}
            >
              {isDeleting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>
                    Deleting...
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>
                  Delete
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
