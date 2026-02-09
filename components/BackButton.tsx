// components/BackButton.tsx
/**
 * Custom back button component for navigation header
 * Falls back to tabs if no history available
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROUTES } from '../constants/navigation';

export default function BackButton() {
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace(ROUTES.TABS);
    }
  };

  return (
    <Pressable
      onPress={goBack}
      hitSlop={10}
      style={{
        paddingHorizontal: 1, 
        paddingTop: insets.top ? insets.top / 4 : 8,
      }}
      accessibilityLabel="Go back"
      accessibilityRole="button"
    >
      <Ionicons name="chevron-back" size={24} color="#111827" />
    </Pressable>
  );
}