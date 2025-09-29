// components/PrivacySelector.tsx
import { View } from 'react-native';
import SegmentedControl from './ui/SegmentedControl';

const options = ['Public', 'Only Me', 'My Friends', 'Members'] as const;
export type PrivacyOption = typeof options[number];

export default function PrivacySelector({
  value,
  onChange,
}: {
  value: PrivacyOption;
  onChange: (v: PrivacyOption) => void;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <SegmentedControl options={options} value={value} onChange={onChange} />
    </View>
  );
}