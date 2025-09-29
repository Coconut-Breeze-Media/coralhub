import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { BPMember } from '../lib/api';

const BORDER = '#e5e7eb';
const MUTED  = '#6b7280';

type Props = {
  likers: BPMember[];          // may contain many; we render only a few
  count: number;               // authoritative like count (not derived from likers.length)
  summaryText: string;         // “You and 3 others liked this”
  maxAvatars?: number;         // how many avatars to show (default 3)
  onPressMore?: () => void;    // called when user taps “+X more”
};

function LikeStripBase({
  likers,
  count,
  summaryText,
  maxAvatars = 3,
  onPressMore,
}: Props) {
  const list = Array.isArray(likers) ? likers : [];

  // Only consider entries we can actually render (have a URI)
  const renderable = list.filter(m => !!(m.avatar_urls?.thumb || m.avatar_urls?.full));
  const show = renderable.slice(0, maxAvatars);
  const displayedCount = show.length;
  const extra = Math.max(0, count - displayedCount);

  return (
    <View
      style={{
        paddingTop: 8,
        paddingBottom: 6,
        borderTopWidth: 1,
        borderColor: BORDER,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'nowrap',
      }}
      accessibilityRole="summary"
      accessibilityLabel={`${count} likes`}
    >
      {/* Avatars */}
      <View style={{ flexDirection: 'row' }}>
        {show.map(m => {
          const uri = m.avatar_urls!.thumb || m.avatar_urls!.full!;
          return (
            <Image
              key={m.id}
              source={{ uri }}
              style={{
                width: 28, height: 28, borderRadius: 14,
                marginRight: -6, borderWidth: 2, borderColor: '#fff',
                backgroundColor: '#ddd',
              }}
              accessibilityLabel={m.name ? `${m.name} liked this` : 'Liked by user'}
            />
          );
        })}
      </View>

      {/* Count */}
      <Text style={{ color: MUTED, fontWeight: '600' }} numberOfLines={1}>
        {count} {count === 1 ? 'like' : 'likes'}
      </Text>

      {/* Optional “+X more” */}
      {extra > 0 && typeof onPressMore === 'function' && (
        <TouchableOpacity
          onPress={onPressMore}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`Show ${extra} more people who liked this`}
        >
          <Text style={{ color: MUTED }}>· +{extra} more</Text>
        </TouchableOpacity>
      )}

      {/* Summary (names/You/etc.) */}
      {!!summaryText && (
        <Text style={{ color: MUTED }} numberOfLines={1}>
          · {summaryText}
        </Text>
      )}
    </View>
  );
}

/**
 * Memoization:
 * - Re-render only if: count or summaryText change,
 *   or the first N actually-rendered likers (by id/avatar URL) change,
 *   or maxAvatars / onPressMore identity change.
 */
function areEqual(prev: Props, next: Props) {
  if (prev.count !== next.count) return false;
  if (prev.summaryText !== next.summaryText) return false;
  if ((prev.maxAvatars ?? 3) !== (next.maxAvatars ?? 3)) return false;
  if (prev.onPressMore !== next.onPressMore) return false;

  const n = Math.min(prev.maxAvatars ?? 3, next.maxAvatars ?? 3);

  const a = (Array.isArray(prev.likers) ? prev.likers : [])
    .filter(m => !!(m.avatar_urls?.thumb || m.avatar_urls?.full))
    .slice(0, n);
  const b = (Array.isArray(next.likers) ? next.likers : [])
    .filter(m => !!(m.avatar_urls?.thumb || m.avatar_urls?.full))
    .slice(0, n);

  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]; const bi = b[i];
    const aUri = ai.avatar_urls?.thumb || ai.avatar_urls?.full || '';
    const bUri = bi.avatar_urls?.thumb || bi.avatar_urls?.full || '';
    if (ai.id !== bi.id || aUri !== bUri) return false;
  }
  return true;
}

export default React.memo(LikeStripBase, areEqual);