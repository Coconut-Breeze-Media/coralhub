// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { useActivityReplies } from '../../hooks/useActivityReplies';
import ActivityRow from '../../components/ActivityRow';

import Card from '../../components/ui/Card';
import FilterBar, { type ScopeFilter } from '../../components/FilterBar';
import ComposerActions from '../../components/ComposerActions';
import PrivacySelector, { type PrivacyOption } from '../../components/PrivacySelector';
import { Ionicons } from '@expo/vector-icons';
import { pickAttachment, type Attachment, type ActionType } from '../../utils/picker';

const PRIMARY = '#0077b6';
const BORDER  = '#e5e7eb';

export default function ActivityTab() {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.max(0, width - 32), [width]);

   // ===== Composer state =====
   const [composer, setComposer] = useState('');
   const [privacy, setPrivacy] = useState<PrivacyOption>('Public');
   const [scope, setScope] = useState<ScopeFilter>('All Members');
   const [attachments, setAttachments] = useState<Attachment[]>([]);
   const [linkModal, setLinkModal] = useState(false);
   const [linkUrl, setLinkUrl] = useState('');

   const {
    items, loading, refreshing, hasMore,
    load, refresh, loadMore,
    submitStatus, // <-- we'll pass a payload to this
    toggleLike,
    error,
  } = useActivityFeed(20 /*, { scope }*/);

  const replies = useActivityReplies();

  // Initial load
  useEffect(() => { load(1, true); }, [load /*, scope*/]);

  // ===== Handlers =====
  const handlePick = useCallback(async (type: ActionType) => {
    if (type === 'link') {
      setLinkModal(true);
      return;
    }
    const att = await pickAttachment(type);
    if (att) setAttachments(prev => [...prev, att]);
  }, []);

  const removeAttachment = useCallback((uri: string) => {
    setAttachments(prev => prev.filter(a => a.uri !== uri));
  }, []);

  // Map UI privacy to API values used by BuddyBoss
  const apiPrivacy = useCallback((p: PrivacyOption) => {
    switch (p) {
      case 'Public': return 'public';
      case 'Only Me': return 'onlyme';
      case 'My Friends': return 'friends';
      case 'Members': return 'groups'; // or 'loggedin' if you use that
      default: return 'public';
    }
  }, []);

  // Submit including text, privacy, scope, attachments, link
  const handleSubmit = useCallback(async () => {
    const text = composer.trim();
    if (!text && !attachments.length && !linkUrl) return;

  // Minimal payload; your hook will:
    // 1) upload files to /wp-json/wp/v2/media, get media_ids
    // 2) POST /wp-json/buddyboss/v1/activity with { content, privacy, media_ids, group_id? }
    const payload = {
      text,
      privacy: apiPrivacy(privacy),   // 'public' | 'friends' | 'onlyme' | 'groups'
      scope,                          // optional: pass to your GET hook as well
      link: linkUrl || undefined,
      attachments,                    // local URIs; the hook handles actual upload
    };

    // @ts-ignore — extend your hook signature to accept payload
    await submitStatus(text, payload);

    // reset
    setComposer('');
    setAttachments([]);
    setLinkUrl('');
    setLinkModal(false);
  }, [composer, attachments, linkUrl, privacy, scope, submitStatus, apiPrivacy]);

  // Infinite scroll guards
  const endReachedOK = useRef(true);
  const handleEndReached = useCallback(() => {
    if (!endReachedOK.current) return;
    endReachedOK.current = false;
    if (hasMore && !loading && !refreshing) loadMore();
  }, [hasMore, loading, refreshing, loadMore]);
  const onMomentumScrollBegin = useCallback(() => { endReachedOK.current = true; }, []);

  // ===== Header: Filter + Composer =====
  const ListHeader = useCallback(() => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: '#fff' }}
    >
      {/* Filter bar (friends, groups, etc.) */}
      <FilterBar active={scope} onChange={(s) => setScope(s)} />

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>What’s new?</Text>

          <TextInput
            value={composer}
            onChangeText={setComposer}
            placeholder="Share an update…"
            multiline
            style={{
              borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, minHeight: 60,
            }}
          />

        {/* Action buttons: photo/file/video/audio/link */}
        <ComposerActions onPick={handlePick} />

        {/* Attachments preview (chips) */}
        {attachments.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {attachments.map((att) => (
              <TouchableOpacity
                key={att.uri}
                onPress={() => removeAttachment(att.uri)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 6, paddingHorizontal: 10, marginRight: 8, marginTop: 8,
                  borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb',
                  backgroundColor: '#f8fafc',
                }}
              >
                <Ionicons name="close-circle-outline" size={16} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: '#334155' }}>{att.type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Privacy */}
        <PrivacySelector value={privacy} onChange={setPrivacy} />

        {/* Post button */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!composer.trim() && attachments.length === 0 && !linkUrl}
            style={{
              backgroundColor: (composer.trim() || attachments.length || linkUrl) ? '#0077b6' : '#93c5fd',
              paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
              opacity: (composer.trim() || attachments.length || linkUrl) ? 1 : 0.8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>

      {/* Link modal */}
      <Modal visible={linkModal} transparent animationType="fade" onRequestClose={() => setLinkModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>Add a link</Text>
            <TextInput
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://example.org"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setLinkModal(false)} style={{ marginRight: 12 }}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLinkModal(false)}>
                <Text style={{ color: PRIMARY, fontWeight: '600' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  ), [scope, composer, attachments, privacy, linkModal, linkUrl, handlePick, removeAttachment, handleSubmit, error]);

  // ===== Render items / footers (unchanged) =====
  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ActivityRow
        item={item}
        contentWidth={contentWidth}
        onLike={(id, liked) => toggleLike(id, liked)}
        onToggleComments={() => {
          replies.toggleOpen(item.id);
          if (!replies.isLoading(item.id) && !replies.getReplies(item.id).length) {
            replies.load(item.id);
          }
        }}
        commentsOpen={replies.isOpen(item.id)}
        replies={replies.getReplies(item.id)}
        repliesLoading={replies.isLoading(item.id)}
        replyValue={replies.getDraft(item.id)}
        onChangeReply={(v) => replies.setDraft(item.id, v)}
        onSubmitReply={() => replies.submit(item.id)}
        errorMessage={replies.getError(item.id) ?? undefined}
      />
    ),
    [contentWidth, replies, toggleLike]
  );

  const ListFooter = useCallback(() => {
    if (loading && hasMore) return <View style={{ paddingVertical: 16 }}><ActivityIndicator /></View>;
    if (!loading && !refreshing && items.length > 0 && !hasMore)
      return <View style={{ paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: '#6b7280' }}>You’re all caught up</Text></View>;
    return null;
  }, [loading, refreshing, hasMore, items.length]);

  const ListEmpty = useCallback(() => {
    if (loading || refreshing) return null;
    return <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: '#6b7280' }}>No posts yet. Be the first to share something!</Text></View>;
  }, [loading, refreshing]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onEndReachedThreshold={0.4}
        onEndReached={handleEndReached}
        onMomentumScrollBegin={onMomentumScrollBegin}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
      />
    </SafeAreaView>
  );
}