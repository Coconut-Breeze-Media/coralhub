// components/BackButton.tsx
/**
 * Custom back button component for navigation header
 * Can use navigation history or route to an explicit fallback target
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROUTES } from '../constants/navigation';

type BackButtonProps = {
  fallbackRoute?: Href;
  useHistory?: boolean;
};

export default function BackButton({
  fallbackRoute = ROUTES.TABS,
  useHistory = true,
}: BackButtonProps) {
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (useHistory && router.canGoBack?.()) {
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
