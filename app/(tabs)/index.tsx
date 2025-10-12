import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useActivityFeed } from '../../hooks/useActivityFeed';
import { useActivityReplies } from '../../hooks/useActivityReplies';
import ActivityRow from '../../components/ActivityRow';

import FeedHeader from '../../components/feed/FeedHeader';
import ActivityList from '../../components/feed/ActivityList';
import LinkModal from '../../components/feed/LinkModal';
import { toApiPrivacy, type PrivacyOption } from '../../utils/privacy';
import { pickAttachment, type Attachment, type ActionType } from '../../utils/picker';
import { type ScopeFilter } from '../../components/FilterBar';

export default function ActivityTab() {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.max(0, width - 32), [width]);

  // Composer state
  const [composer, setComposer] = useState('');
  const [privacy, setPrivacy]   = useState<PrivacyOption>('Public');
  const [scope, setScope]       = useState<ScopeFilter>('All Members');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkModal, setLinkModal]     = useState(false);
  const [linkUrl, setLinkUrl]         = useState('');

  const {
    items, loading, refreshing, hasMore,
    load, refresh, loadMore,
    submitStatus,
    toggleLike,
    error,
  } = useActivityFeed(20 /*, { scope }*/);

  const replies = useActivityReplies();

  // Initial load
  useEffect(() => { load(1, true); }, [load]);

  // Handlers
  const handlePick = useCallback(async (type: ActionType) => {
    if (type === 'link') { setLinkModal(true); return; }
    const att = await pickAttachment(type);
    if (att) setAttachments(prev => [...prev, att]);
  }, []);

  const removeAttachment = useCallback((uri: string) => {
    setAttachments(prev => prev.filter(a => a.uri !== uri));
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = composer.trim();
    if (!text && !attachments.length && !linkUrl) return;

    const payload = {
      text,
      privacy: toApiPrivacy(privacy),
      scope,
      link: linkUrl || undefined,
      attachments,
    };

    // @ts-ignore – extend your hook to accept payload
    await submitStatus(text, payload);

    setComposer('');
    setAttachments([]);
    setLinkUrl('');
    setLinkModal(false);
  }, [composer, attachments, linkUrl, privacy, scope, submitStatus]);

  // Feed list item
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

  // Infinite scroll guard
  const endReachedOK = useRef(true);
  const handleEndReached = useCallback(() => {
    if (!endReachedOK.current) return;
    endReachedOK.current = false;
    if (hasMore && !loading && !refreshing) loadMore();
  }, [hasMore, loading, refreshing, loadMore]);
  const onMomentumScrollBegin = useCallback(() => { endReachedOK.current = true; }, []);

  // Header + modal
  const header = (
    <>
      <FeedHeader
        scope={scope}
        onChangeScope={setScope}
        composer={composer}
        onChangeComposer={setComposer}
        privacy={privacy}
        onChangePrivacy={setPrivacy}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onPick={handlePick}
        onSubmit={handleSubmit}
        onOpenLink={() => setLinkModal(true)}
        canSubmit={!!(composer.trim() || attachments.length || linkUrl)}
      />
      <LinkModal
        visible={linkModal}
        url={linkUrl}
        onChange={setLinkUrl}
        onDismiss={() => setLinkModal(false)}
        onConfirm={() => setLinkModal(false)}
      />
    </>
  );

  return (
    <ActivityList
      data={items}
      renderItem={renderItem}
      header={header}
      footerWhen={{ loading, hasMore, itemsCount: items.length }}
      emptyWhen={{ loading, refreshing }}
      onRefresh={refresh}
      refreshing={refreshing}
      onEndReached={handleEndReached}
      onMomentumScrollBegin={onMomentumScrollBegin}
    />
  );
}