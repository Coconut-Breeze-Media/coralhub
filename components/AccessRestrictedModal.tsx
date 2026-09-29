// components/AccessRestrictedModal.tsx
import { Modal, Pressable, Text, View } from 'react-native';

const PRIMARY = '#0077b6';

interface Props {
  visible: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}

export default function AccessRestrictedModal({ visible, onUpgrade, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>
            Membership required
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#374151', marginBottom: 20 }}>
            Your current membership level does not allow access to this content
          </Text>
          <Pressable
            onPress={onUpgrade}
            accessibilityRole="button"
            accessibilityLabel="Upgrade Now"
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: PRIMARY,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Upgrade Now</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Go Back"
            style={{
              height: 48,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: PRIMARY,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 16 }}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
