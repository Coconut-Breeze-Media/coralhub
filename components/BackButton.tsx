// components/BackButton.tsx
/**
 * Custom back button component for navigation header
 * Falls back to tabs if no history available
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROUTES } from '../constants/navigation';

type BackButtonProps = {
  fallbackRoute?: Href;
};

export default function BackButton({
  fallbackRoute = ROUTES.TABS,
}: BackButtonProps) {
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace(fallbackRoute);
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
