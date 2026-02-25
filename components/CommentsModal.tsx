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
import type { WPComment } from '../types';
import MentionInput from './MentionInput';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: number;
  token: string | null;
  currentUserId?: number | null;
}

// ─────────────────────────────────────────────
// Single comment row with inline edit / delete
// ─────────────────────────────────────────────
function CommentItem({
  item,
  postId,
  token,
  canModify,
}: {
  item: WPComment;
  postId: number;
  token: string | null;
  canModify: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const updateMutation = useUpdateComment(token);
  const deleteMutation = useDeleteComment(token);

  const avatarUrl =
    item.author_avatar_urls?.['48'] ||
    item.author_avatar_urls?.['96'] ||
    item.author_avatar_urls?.['24'];

  const content = item.content?.rendered?.replace(/<[^>]+>/g, '').trim() || '';
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
      await updateMutation.mutateAsync({ commentId: item.id, content: text });
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
    <View style={styles.commentItem}>
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
          <Text style={styles.commentAvatarText}>
            {item.author_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        )}
      </View>

      {/* Bubble */}
      <View style={styles.commentBubble}>
        {/* Header row: author + actions */}
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{item.author_name || 'Anonymous'}</Text>

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

        <Text style={styles.commentDate}>{date}</Text>
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

  const { data: comments, isLoading, refetch } = usePostComments(
    token,
    visible ? postId : null
  );
  const createCommentMutation = useCreateComment(token);

  const handleSubmit = async () => {
    const text = newComment.trim();
    if (!text) return;
    try {
      await createCommentMutation.mutateAsync({ postId, content: text });
      setNewComment('');
      refetch();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to post comment. Please try again.');
    }
  };

  const commentCount = comments?.length ?? 0;

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
              data={comments || []}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <CommentItem
                  item={item}
                  postId={postId}
                  token={token}
                  canModify={
                    !!currentUserId &&
                    !!item.author &&
                    Number(currentUserId) === Number(item.author)
                  }
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
  commentDate: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
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
