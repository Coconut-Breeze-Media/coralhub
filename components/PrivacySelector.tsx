// components/PrivacySelector.tsx
import { View, TouchableOpacity, Text } from 'react-native';

const options = ["Public", "Only Me", "My Friends", "Members"] as const;
type PrivacyOption = typeof options[number];

export default function PrivacySelector({
  value,
  onChange,
}: {
  value: PrivacyOption;
  onChange: (v: PrivacyOption) => void;
}) {
  return (
    <View style={{ flexDirection: "row", marginTop: 8 }}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          onPress={() => onChange(o)}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: value === o ? "#0077b6" : "#6b7280" }}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}