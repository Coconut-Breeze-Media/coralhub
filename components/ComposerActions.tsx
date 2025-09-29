// components/ComposerActions.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ACTIONS = [
  { key: 'photo', icon: 'image-outline' as IoniconName, label: 'Photo' },
  { key: 'file',  icon: 'document-outline' as IoniconName, label: 'File' },
  { key: 'video', icon: 'videocam-outline' as IoniconName, label: 'Video' },
  { key: 'audio', icon: 'mic-outline' as IoniconName, label: 'Audio' },
  { key: 'link',  icon: 'link-outline' as IoniconName, label: 'Link' },
] as const;

export type ActionType = typeof ACTIONS[number]['key'];

type Counts = Partial<Record<ActionType, number>>;

export default function ComposerActions({
  onPick,
  onQuick, // optional: long-press quick action (e.g., camera)
  counts,
  disabled,
}: {
  onPick: (type: ActionType) => void;
  onQuick?: (type: ActionType) => void;
  counts?: Counts;
  disabled?: boolean;
}) {
  const items = useMemo(() => ACTIONS, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
      {items.map((a) => (
        <ActionChip
          key={a.key}
          icon={a.icon}
          label={a.label}
          count={counts?.[a.key]}
          disabled={disabled}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPick(a.key);
          }}
          onLongPress={
            onQuick
              ? () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onQuick(a.key);
                }
              : undefined
          }
          accessibilityLabel={a.label}
          accessibilityHint={
            onQuick
              ? `Opens picker. Long-press for quick ${a.key === 'photo' ? 'camera' : a.label.toLowerCase()}.`
              : `Opens ${a.label.toLowerCase()} picker.`
          }
        />
      ))}
    </View>
  );
}

function ActionChip({
  icon,
  label,
  count = 0,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: IoniconName;
  label: string;
  count?: number;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const scale = new Animated.Value(1);

  const animateIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
  const animateOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <View style={{ alignItems: 'center', marginRight: 12 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPressIn={animateIn}
          onPressOut={animateOut}
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={disabled}
          android_ripple={{ color: '#dbeafe', borderless: true }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: disabled ? '#e5e7eb' : '#e9f3fb',
          }}
        >
          <Ionicons name={icon} size={22} color={disabled ? '#9ca3af' : '#0b72b0'} />
          {count > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                backgroundColor: '#0b72b0',
                borderRadius: 9,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count}</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
      <Text
        style={{
          fontSize: 11,
          marginTop: 6,
          color: disabled ? '#9ca3af' : '#374151',
          fontWeight: Platform.OS === 'ios' ? '500' : '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
}