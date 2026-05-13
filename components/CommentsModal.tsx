// components/CommentsModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import {
  usePostComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from '../hooks/useActivity';
import type { BPActivity } from '../types';
import MentionInput from './MentionInput';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: number;
  token: string | null;
  currentUserId?: number | null;
}

interface FlatComment extends BPActivity {
  depth: number;
}

function extractAuthorFromTitle(title: string): string {
  const m = title?.match(/>([^<]+)</);
  return m ? m[1].trim() : 'Anonymous';
}

function resolveAuthor(item: BPActivity): string {
  if (item.user_name) return item.user_name;
  if (item.title) return extractAuthorFromTitle(item.title);
  return 'Anonymous';
}

function flattenThreaded(items: any[], depth = 0): FlatComment[] {
  const result: FlatComment[] = [];
  for (const item of items) {
    const nested: any[] = item.comments
      ? (Array.isArray(item.comments) ? item.comments : Object.values(item.comments))
      : [];
    if (!item.id) {
      result.push(...flattenThreaded(nested, depth));
    } else {
      result.push({ ...item, depth });
      if (nested.length > 0) {
        result.push(...flattenThreaded(nested, depth + 1));
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Single comment row with inline edit / delete
// ─────────────────────────────────────────────
function CommentItem({
  item,
  postId,
  token,
  canModify,
  onReply,
}: {
  item: FlatComment;
  postId: number;
  token: string | null;
  canModify: boolean;
  onReply: (commentId: number, authorName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const updateMutation = useUpdateComment(token);
  const deleteMutation = useDeleteComment(token);

  const avatarUrl =
    typeof item.user_avatar === 'string'
      ? item.user_avatar
      : item.user_avatar?.full || item.user_avatar?.thumb;

  const rawContent = typeof item.content === 'string' ? item.content : item.content?.rendered || '';
  const content = rawContent.replace(/<[^>]+>/g, '').trim();
  const authorName = resolveAuthor(item);
  const avatarInitial = authorName !== 'Anonymous' ? authorName.charAt(0).toUpperCase() : '?';
  const date = new Date(item.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleEditPress = () => {
    setEditText(content);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const text = editText.trim();
    if (!text) return;
    try {
      await updateMutation.mutateAsync({ commentId: item.id, content: text, postId });
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update comment.');
    }
  };

  const handleDelete = () => {
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteConfirmVisible(false);
    try {
      await deleteMutation.mutateAsync({ commentId: item.id, postId });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete comment.');
    }
  };

  return (
    <View
      style={[
        styles.commentItem,
        item.depth > 0 && { paddingLeft: 16 + item.depth * 20, paddingRight: 16 },
      ]}
    >
      {item.depth > 0 && (
        <View
          style={[styles.depthLine, { left: 16 + (item.depth - 1) * 20 + 4 }]}
          pointerEvents="none"
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmIcon}>🗑️</Text>
            <Text style={styles.confirmTitle}>Delete Comment?</Text>
            <Text style={styles.confirmMessage}>
              This action cannot be undone. Your comment will be permanently removed.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setDeleteConfirmVisible(false)}
                disabled={deleteMutation.isPending}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, deleteMutation.isPending && styles.confirmDeleteBtnDisabled]}
                onPress={handleConfirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar */}
      <View style={styles.commentAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.commentAvatarImage} />
        ) : (
          <Text style={styles.commentAvatarText}>{avatarInitial}</Text>
        )}
      </View>

      {/* Bubble */}
      <View style={styles.commentBubble}>
        {/* Header row: author + actions */}
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{authorName}</Text>

          {canModify && !isEditing && (
            <View style={styles.commentActions}>
              <TouchableOpacity onPress={handleEditPress} style={styles.actionIconBtn}>
                <Text style={styles.actionIconText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.actionIconBtn}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Text style={styles.actionIconText}>🗑️</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Content — normal or edit mode */}
        {isEditing ? (
          <>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              maxLength={500}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                style={styles.editCancelBtn}
                disabled={updateMutation.isPending}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[
                  styles.editSaveBtn,
                  (!editText.trim() || updateMutation.isPending) && styles.editSaveBtnDisabled,
                ]}
                disabled={!editText.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.commentText}>{content}</Text>
        )}

        <View style={styles.commentFooter}>
          <Text style={styles.commentDate}>{date}</Text>
          {!isEditing && (
            <TouchableOpacity
              onPress={() => onReply(item.id, authorName)}
              style={styles.replyBtn}
            >
              <Text style={styles.replyBtnText}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────
export default function CommentsModal({
  visible,
  onClose,
  postId,
  token,
  currentUserId,
}: CommentsModalProps) {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; authorName: string } | null>(null);

  const { data: comments, isLoading, refetch } = usePostComments(
    token,
    visible ? postId : null
  );
  const createCommentMutation = useCreateComment(token);

  const flatComments = flattenThreaded(comments || []);
  const commentCount = flatComments.length;

  const handleReply = (commentId: number, authorName: string) => {
    setReplyTo({ id: commentId, authorName });
  };

  const handleSubmit = async () => {
    const text = newComment.trim();
    if (!text) return;
    try {
      await createCommentMutation.mutateAsync({
        postId,
        content: text,
        parentCommentId: replyTo?.id,
      });
      setNewComment('');
      setReplyTo(null);
      refetch();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to post comment. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Comments{commentCount > 0 ? ` (${commentCount})` : ''}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          {isLoading ? (
            <ActivityIndicator style={styles.loader} color="#0e7490" />
          ) : (
            <FlatList
              data={flatComments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <CommentItem
                  item={item}
                  postId={postId}
                  token={token}
                  canModify={
                    !!currentUserId &&
                    !!item.user_id &&
                    Number(currentUserId) === Number(item.user_id)
                  }
                  onReply={handleReply}
                />
              )}
              style={styles.list}
              contentContainerStyle={
                commentCount === 0 ? styles.emptyContainer : styles.listContent
              }
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No comments yet. Be the first to comment!
                </Text>
              }
            />
          )}

          {/* Reply context banner */}
          {replyTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Replying to {replyTo.authorName}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Text style={styles.replyBannerClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* New comment input */}
          <View style={styles.inputRow}>
            <MentionInput
              value={newComment}
              onChangeText={setNewComment}
              token={token}
              placeholder="Write a comment..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
              maxHeight={100}
              style={styles.input}
              suggestionPosition="above"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newComment.trim() || createCommentMutation.isPending) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!newComment.trim() || createCommentMutation.isPending}
            >
              {createCommentMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#6b7280',
  },
  loader: {
    marginVertical: 32,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Comment row
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  depthLine: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: 2,
    borderRadius: 1,
    backgroundColor: '#0e7490',
    opacity: 0.25,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0e7490',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  commentAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  actionIconBtn: {
    padding: 2,
  },
  actionIconText: {
    fontSize: 14,
  },
  commentText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  commentDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  replyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  replyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0e7490',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfeff',
    borderTopWidth: 1,
    borderTopColor: '#a5f3fc',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  replyBannerText: {
    fontSize: 13,
    color: '#0e7490',
    flex: 1,
  },
  replyBannerClose: {
    paddingLeft: 8,
    fontSize: 16,
    color: '#0e7490',
  },
  // Inline edit
  editInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  editCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  editCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  editSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0e7490',
    minWidth: 50,
    alignItems: 'center',
  },
  editSaveBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  editSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  // New comment input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
    backgroundColor: '#f9fafb',
  },
  sendButton: {
    backgroundColor: '#0e7490',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  sendText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Delete confirmation modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  confirmIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmDeleteBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
