// components/BackButton.tsx
/**
 * Custom back button component for navigation header
 * Can use navigation history or route to an explicit fallback target
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { ROUTES } from '../constants/navigation';

type BackButtonProps = {
  fallbackRoute?: Href;
  useHistory?: boolean;
};

export default function BackButton({
  fallbackRoute = ROUTES.TABS,
  useHistory = true,
}: BackButtonProps) {
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
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel="Go back"
      accessibilityRole="button"
    >
      <Ionicons name="chevron-back" size={24} color="#111827" />
    </Pressable>
  );
}
