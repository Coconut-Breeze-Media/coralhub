// components/ComposerAvatar.tsx
//
// The current user's profile picture shown beside the News Feed and group
// post composers. Falls back to the display-name initial while the member
// record loads, when the site only has its "please upload" placeholder, or if
// the image fails to load.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useMember } from '../hooks/useMembers';
import { toAbsoluteUrl } from '../lib/postContent';

export default function ComposerAvatar({ size = 40 }: { size?: number }) {
  const { token, userId, profile } = useAuth();
  const { data: member } = useMember(token, userId ?? profile?.user_id);
  const [failed, setFailed] = useState(false);

  const rawUrl = member?.avatar_urls?.full || member?.avatar_urls?.thumb;
  const avatarUrl =
    rawUrl && !rawUrl.includes('Please-Upload-Avatar-Image') ? toAbsoluteUrl(rawUrl) : undefined;

  // A new upload changes the URL — try loading it again.
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const name = member?.name || profile?.user_display_name || '';
  const initial = name.trim().charAt(0).toUpperCase() || 'U';
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.avatar, dimensions]}>
      {avatarUrl && !failed ? (
        <Image
          source={{ uri: avatarUrl }}
          style={dimensions}
          onError={() => setFailed(true)}
          accessibilityLabel="Your profile picture"
        />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.45) }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#0095f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  initial: {
    color: '#fff',
    fontWeight: '600',
  },
});
