import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import {
  useActivityById,
  useDeletePost,
  useLikePost,
  useUpdatePost,
} from '../hooks/useActivity';
import { useMyGroups } from '../hooks/useGroups';
import PostCard from '../components/PostCard';
import PostActionModals from '../components/PostActionModals';
import type { BPActivity } from '../types';

function getEditableText(activity: BPActivity): string {
  const value =
    typeof activity.content === 'string'
      ? activity.content
      : activity.content.raw || activity.content.rendered || '';
  return value.replace(/<[^>]+>/g, '').trim();
}

export default function PostDetailScreen() {
  const { id, comments } = useLocalSearchParams<{ id?: string; comments?: string }>();
  const activityId = id ? Number(id) : null;
  const { token, profile } = useAuth();
  const {
    data: linkedActivity,
    isLoading: isLinkedActivityLoading,
    error: linkedActivityError,
  } = useActivityById(token, activityId);
  const parentActivityId =
    linkedActivity?.type === 'activity_comment' &&
    Number(linkedActivity.primary_item_id) !== Number(linkedActivity.id)
      ? Number(linkedActivity.primary_item_id)
      : null;
  const {
    data: parentActivity,
    isLoading: isParentActivityLoading,
    error: parentActivityError,
  } = useActivityById(token, parentActivityId);
  const activity = parentActivityId ? parentActivity : linkedActivity;
  const isLoading = isLinkedActivityLoading || (!!parentActivityId && isParentActivityLoading);
  const error = parentActivityId ? parentActivityError : linkedActivityError;
  const shouldOpenComments = comments === '1' || linkedActivity?.type === 'activity_comment';
  const { data: groups } = useMyGroups(token);
  const likeMutation = useLikePost(token);
  const updateMutation = useUpdatePost(token);
  const deleteMutation = useDeletePost(token);
  const [editingPost, setEditingPost] = useState<BPActivity | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingPost, setDeletingPost] = useState<BPActivity | null>(null);

  const handleLike = async (targetId: number, isLiked: boolean) => {
    try {
      await likeMutation.mutateAsync({ activityId: targetId, isLiked });
    } catch (likeError: any) {
      Alert.alert('Error', likeError?.message || 'Failed to update reaction.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editContent.trim()) return;
    try {
      await updateMutation.mutateAsync({
        activityId: editingPost.id,
        content: editContent.trim(),
        component: editingPost.component,
        primary_item_id: editingPost.primary_item_id,
      });
      setEditingPost(null);
    } catch (editError: any) {
      Alert.alert('Error', editError?.message || 'Failed to update post.');
    }
  };

  const handleDelete = async () => {
    if (!deletingPost) return;
    try {
      await deleteMutation.mutateAsync(deletingPost.id);
      setDeletingPost(null);
      router.back();
    } catch (deleteError: any) {
      Alert.alert('Error', deleteError?.message || 'Failed to delete post.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      ) : error || !activity ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Post unavailable</Text>
          <Text style={styles.errorText}>It may have been removed or you may not have access.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <PostCard
            item={activity}
            token={token}
            profile={profile}
            groups={groups}
            onLike={handleLike}
            onEdit={(item) => {
              setEditingPost(item);
              setEditContent(getEditableText(item));
            }}
            onDelete={setDeletingPost}
            initialCommentsOpen={shouldOpenComments}
          />
        </ScrollView>
      )}

      <PostActionModals
        isEditVisible={!!editingPost}
        editContent={editContent}
        onChangeEditContent={setEditContent}
        onCloseEdit={() => setEditingPost(null)}
        onSaveEdit={handleSaveEdit}
        isSaving={updateMutation.isPending}
        isDeleteVisible={!!deletingPost}
        onCloseDelete={() => setDeletingPost(null)}
        onConfirmDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingVertical: 16 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  errorText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});
