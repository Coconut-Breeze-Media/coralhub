import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export default function IconRound({
  name, onPress, disabled,
}: { name: keyof typeof Ionicons.glyphMap; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: disabled ? '#e5e7eb' : '#eef6fb',
        marginRight: 8,
      }}
    >
      <Ionicons name={name} size={20} color={disabled ? '#9ca3af' : '#0077b6'} />
    </TouchableOpacity>
  );
}