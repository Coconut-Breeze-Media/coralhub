import React from 'react';
import {
  View,
  Text,
  Image,
  Linking,
  Platform,
  Pressable,
} from 'react-native';

const TITLE = '#111827'; // gray-900
const MUTED = '#6b7280'; // gray-500
const LINK  = '#2563eb'; // blue-600
const BORDER = '#e5e7eb';

export type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string; // reserved for future; not rendered here
  imageUrl?: string;
  domain?: string;       // optional override (e.g., “example.org”)
  onPress?: () => void;  // optional; defaults to open URL
};

function getHostname(u: string): string {
  try {
    const host = new URL(u).hostname.replace(/^www\./, '');
    return host || u;
  } catch {
    return u;
  }
}

function LinkPreviewCardBase({
  url,
  title,
  imageUrl,
  domain,
  onPress,
}: LinkPreviewData) {
  const displayHost = (domain && domain.trim()) || getHostname(url);
  const hasImage = !!imageUrl && /^https?:\/\//i.test(imageUrl);

  const open = React.useCallback(() => {
    if (onPress) return onPress();
    Linking.openURL(url);
  }, [onPress, url]);

  return (
    <Pressable
      onPress={open}
      android_ripple={Platform.OS === 'android' ? { color: '#e5e7eb' } : undefined}
      style={{
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 8,
        padding: 16,
        gap: 10,
        overflow: 'hidden',
      }}
      accessibilityRole="link"
      accessibilityLabel={title ? `${title}. Opens ${displayHost}` : `Opens ${displayHost}`}
      accessibilityHint={`Opens ${displayHost} in the browser`}
    >
      {/* Image with fixed aspect to prevent layout shift */}
      {hasImage && (
        <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 6, overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
          <Image
            source={{ uri: imageUrl! }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </View>
      )}

      {!!title && (
        <Text
          style={{ fontWeight: '700', color: TITLE, fontSize: 16, lineHeight: 22 }}
          numberOfLines={2}
        >
          {title}
        </Text>
      )}

      <Text
        style={{ color: LINK, fontWeight: '700', letterSpacing: 0.4 }}
        numberOfLines={1}
      >
        {displayHost.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/** Avoid re-renders unless url/title/imageUrl/domain/onPress change */
export default React.memo(LinkPreviewCardBase, (a, b) =>
  a.url === b.url &&
  a.title === b.title &&
  a.imageUrl === b.imageUrl &&
  a.domain === b.domain &&
  a.onPress === b.onPress
);