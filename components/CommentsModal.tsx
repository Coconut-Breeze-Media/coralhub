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
import { usePostComments, useCreateComment } from '../hooks/useActivity';
import type { WPComment } from '../types';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: number;
  token: string | null;
}

function CommentItem({ item }: { item: WPComment }) {
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

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.commentAvatarImage} />
        ) : (
          <Text style={styles.commentAvatarText}>
            {item.author_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        )}
      </View>
      <View style={styles.commentBubble}>
        <Text style={styles.commentAuthor}>{item.author_name || 'Anonymous'}</Text>
        <Text style={styles.commentText}>{content}</Text>
        <Text style={styles.commentDate}>{date}</Text>
      </View>
    </View>
  );
}

export default function CommentsModal({ visible, onClose, postId, token }: CommentsModalProps) {
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
              renderItem={({ item }) => <CommentItem item={item} />}
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

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Write a comment..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
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
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
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
});
