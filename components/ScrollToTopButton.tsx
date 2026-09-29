// components/ScrollToTopButton.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#0077b6';
const SIZE = 44;

interface ScrollToTopButtonProps {
  visible: boolean;
  onPress: () => void;
}

/**
 * Floating "back to top" button. Fades and scales in/out as `visible` changes.
 * Render it as a sibling AFTER the scrolling list inside a parent that has
 * `flex: 1` and `position: 'relative'` so the absolute positioning applies.
 */
export default function ScrollToTopButton({ visible, onPress }: ScrollToTopButtonProps) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [visible, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.container, { opacity: progress, transform: [{ scale }] }]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
      >
        <Ionicons name="arrow-up" size={22} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 16,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
