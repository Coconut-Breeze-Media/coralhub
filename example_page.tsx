// Example: app/opportunities.tsx or your Community tab screen
import { useEffect, useState } from 'react';
import { SafeAreaView, FlatList, View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  getCategoryIdBySlug,
  getPostsByCategoryId,
  getTagIdBySlug,
  getPostsByTagId,
  getFeaturedImageUrl,
  stripHtml,
  type WPPost
} from '../lib/api';

const CATEGORY_SLUG = 'opportunities'; // ← change to whatever your site uses
const TAG_SLUG = '';                   // ← or use a tag instead

export default function OpportunitiesScreen() {
  const [posts, setPosts] = useState<WPPost[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [end, setEnd] = useState(false);
  const [useCategory, setUseCategory] = useState<boolean | null>(null);
  const [filterId, setFilterId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Try category first; if not found and TAG_SLUG is set, try tag
      let id = CATEGORY_SLUG ? await getCategoryIdBySlug(CATEGORY_SLUG) : null;
      if (!id && TAG_SLUG) {
        const tid = await getTagIdBySlug(TAG_SLUG);
        if (tid) {
          setUseCategory(false);
          setFilterId(tid);
        }
      } else if (id) {
        setUseCategory(true);
        setFilterId(id);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (filterId == null || loading) return;
      setLoading(true);
      const batch = useCategory
        ? await getPostsByCategoryId(filterId, 1)
        : await getPostsByTagId(filterId, 1);
      setPosts(batch);
      setPage(2);
      setEnd(batch.length === 0);
      setLoading(false);
    })();
  }, [filterId, useCategory]);

  async function loadMore() {
    if (loading || end || filterId == null) return;
    setLoading(true);
    const next = useCategory
      ? await getPostsByCategoryId(filterId, page)
      : await getPostsByTagId(filterId, page);
    if (next.length === 0) setEnd(true);
    setPosts(prev => [...prev, ...next]);
    setPage(p => p + 1);
    setLoading(false);
  }

  const renderItem = ({ item }: { item: WPPost }) => {
    const image = getFeaturedImageUrl(item);
    const title = stripHtml((item as any)?.title?.rendered ?? 'Untitled');
    const excerptHtml = (item as any)?.excerpt?.rendered || (item as any)?.content?.rendered || '';
    const excerpt = stripHtml(excerptHtml);
    return (
      <TouchableOpacity style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
        {image ? (
          <Image source={{ uri: image }} style={{ width: '100%', height: 180, borderRadius: 12, marginBottom: 12 }} />
        ) : null}
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 6 }}>{title}</Text>
        <Text numberOfLines={3} style={{ color: '#374151' }}>{excerpt}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {loading && posts.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}