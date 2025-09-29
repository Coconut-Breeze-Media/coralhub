import IconRound from './ui/IconRound';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
type IoniconName = keyof typeof Ionicons.glyphMap;

const actions = [
  { key: 'photo', icon: 'image-outline' as IoniconName, label: 'Photo' },
  { key: 'file',  icon: 'document-outline' as IoniconName, label: 'File' },
  { key: 'video', icon: 'videocam-outline' as IoniconName, label: 'Video' },
  { key: 'audio', icon: 'mic-outline' as IoniconName, label: 'Audio' },
  { key: 'link',  icon: 'link-outline' as IoniconName, label: 'Link' },
] as const;

export type ActionType = typeof actions[number]['key'];

export default function ComposerActions({ onPick }: { onPick: (type: ActionType) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
      {actions.map((a) => (
        <View key={a.key} style={{ alignItems: 'center', marginRight: 10 }}>
          <IconRound name={a.icon} onPress={() => onPick(a.key)} />
          <Text style={{ fontSize: 11, marginTop: 4, color: '#374151' }}>{a.label}</Text>
        </View>
      ))}
    </View>
  );
}