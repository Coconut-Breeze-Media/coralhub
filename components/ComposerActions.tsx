// components/ComposerActions.tsx
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Type for valid Ionicon names
type IoniconName = keyof typeof Ionicons.glyphMap;

// Define actions with literal types
const actions = [
  { key: 'photo', icon: 'image-outline' as IoniconName, label: 'Photo' },
  { key: 'file',  icon: 'document-outline' as IoniconName, label: 'File' },
  { key: 'video', icon: 'videocam-outline' as IoniconName, label: 'Video' },
  { key: 'audio', icon: 'mic-outline' as IoniconName, label: 'Audio' },
  { key: 'link',  icon: 'link-outline' as IoniconName, label: 'Link' },
] as const;

type ActionType = typeof actions[number]['key'];

export default function ComposerActions({ onPick }: { onPick: (type: ActionType) => void }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 8 }}>
      {actions.map(a => (
        <TouchableOpacity
          key={a.key}
          onPress={() => onPick(a.key)}
          style={{ marginRight: 16, alignItems: 'center' }}
          accessibilityLabel={a.label}
        >
          <Ionicons name={a.icon} size={20} color="#0077b6" />
          <Text style={{ fontSize: 12 }}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}