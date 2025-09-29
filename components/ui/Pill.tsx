import { Text, TouchableOpacity } from 'react-native';

export default function Pill({
  active,
  label,
  onPress,
  style,
}: { active?: boolean; label: string; onPress?: () => void; style?: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: active ? '#0077b6' : '#f3f4f6',
          marginRight: 8,
        },
        style,
      ]}
    >
      <Text style={{ color: active ? '#fff' : '#111827', fontWeight: active ? '600' : '500' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}