// components/ExpandableText.tsx
import React, { useCallback, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextLayoutEventData,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#0077b6';

interface ExpandableTextProps {
  text: string;
  /** Lines shown while collapsed. Default 4. */
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}

/**
 * Text that clamps to `numberOfLines` and shows a "See more" / "See less"
 * toggle only when the content actually overflows.
 *
 * Overflow detection: `onTextLayout` on a clamped <Text> reports the truncated
 * line count on Android but the full count on iOS, so instead we render the
 * FULL text in an invisible, absolutely positioned measuring <Text> and compare
 * its line count against `numberOfLines`. This behaves identically on both
 * platforms.
 */
export default function ExpandableText({
  text,
  numberOfLines = 4,
  style,
  linkStyle,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);

  // Align the toggle with the text's own horizontal padding.
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const paddingHorizontal = flat.paddingHorizontal ?? flat.paddingLeft ?? 16;

  const handleMeasureLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      const lineCount = e.nativeEvent.lines?.length ?? 0;
      setIsTruncatable(lineCount > numberOfLines);
    },
    [numberOfLines]
  );

  if (!text) return null;

  return (
    <View style={styles.wrapper}>
      {/* Invisible measuring pass on the full text */}
      <Text
        style={[style, styles.measure]}
        onTextLayout={handleMeasureLayout}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {text}
      </Text>

      <Text style={style} numberOfLines={expanded ? undefined : numberOfLines}>
        {text}
      </Text>

      {isTruncatable ? (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'See less' : 'See more'}
          style={[styles.toggleButton, { paddingHorizontal }]}
        >
          <Text style={[styles.toggleText, linkStyle]}>{expanded ? 'See less' : 'See more'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: -1,
    // Never take part in layout height; the visible text below drives sizing.
    paddingBottom: 0,
  },
  toggleButton: {
    alignSelf: 'flex-start',
    marginTop: -6,
    paddingBottom: 10,
  },
  toggleText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
});
