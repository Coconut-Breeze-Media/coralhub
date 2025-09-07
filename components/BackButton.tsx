import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BackButton() {
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack?.()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <Pressable
      onPress={goBack}
      hitSlop={10}
      style={{
        paddingHorizontal: 1 , 
        paddingTop: insets.top ? insets.top / 4 : 8, // dynamic top padding
      }}
    >
      <Ionicons name="chevron-back" size={24} color="#111827" />
    </Pressable>
  );
}