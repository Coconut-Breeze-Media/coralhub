// components/ui/SegmentedControl.tsx
import { View, TouchableOpacity, Text } from 'react-native';

type OptionLike = string | number; // generic enough for unions

export default function SegmentedControl<T extends OptionLike>({
  options, value, onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection:'row', backgroundColor:'#f1f5f9', borderRadius:12, padding:4 }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <TouchableOpacity
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: active ? '#0077b6' : 'transparent',
            }}
          >
            <Text style={{ textAlign:'center', color: active ? '#fff' : '#0f172a', fontWeight:'600' }}>
              {String(o)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}