// components/BackButton.tsx
/**
 * Custom back button component for navigation header.
 *
 * Returns to the screen the user was just on (the navigator's history). Only
 * when there is no history — e.g. the app was opened straight onto this
 * screen — does it go to `fallbackRoute`.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { router, useNavigation, type Href } from 'expo-router';
import { ROUTES } from '../constants/navigation';
import { goBackOrFallback, type BackNavigation } from '../lib/tabNavigation';

type BackButtonProps = {
  fallbackRoute?: Href;
  /**
   * Set to false to always open `fallbackRoute` instead of going back.
   * Avoid it: back should return to the screen the user was just on.
   */
  useHistory?: boolean;
};

export default function BackButton({
  fallbackRoute = ROUTES.TABS,
  useHistory = true,
}: BackButtonProps) {
  const navigation = useNavigation<BackNavigation>();

  const goBack = () => {
    if (useHistory) {
      goBackOrFallback(navigation, fallbackRoute);
    } else {
      router.navigate(fallbackRoute);
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
