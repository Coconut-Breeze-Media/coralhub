// components/PostActionModals.tsx
//
// The Edit Post / Delete Post confirmation modals shared by every screen
// that renders <PostCard>. Kept separate from PostCard itself because these
// are rendered once per screen (not once per post) — the screen owns which
// post is currently being edited/deleted.
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

export default function PostActionModals({
  isEditVisible,
  editContent,
  onChangeEditContent,
  onCloseEdit,
  onSaveEdit,
  isSaving,

  isDeleteVisible,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
}: {
  isEditVisible: boolean;
  editContent: string;
  onChangeEditContent: (text: string) => void;
  onCloseEdit: () => void;
  onSaveEdit: () => void;
  isSaving: boolean;

  isDeleteVisible: boolean;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <>
      <Modal
        visible={isEditVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={onCloseEdit}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalCard}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={onCloseEdit}>
                <Text style={styles.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.editInput}
              placeholder="Edit your post..."
              placeholderTextColor="#9ca3af"
              multiline
              value={editContent}
              onChangeText={onChangeEditContent}
              editable={!isSaving}
            />

            <View style={styles.editModalActions}>
              <TouchableOpacity
                onPress={onCloseEdit}
                style={styles.editCancelButton}
                disabled={isSaving}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSaveEdit}
                disabled={isSaving || !editContent.trim()}
                style={[
                  styles.editSaveButton,
                  (isSaving || !editContent.trim()) && styles.editSaveButtonDisabled,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isDeleteVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={onCloseDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Delete Post?</Text>
            <Text style={styles.deleteModalDescription}>
              Are you sure you want to delete this post? This action cannot be undone.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                onPress={onCloseDelete}
                style={styles.deleteCancelButton}
                disabled={isDeleting}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onConfirmDelete}
                disabled={isDeleting}
                style={[
                  styles.deleteConfirmButton,
                  isDeleting && styles.deleteConfirmButtonDisabled,
                ]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  editModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  editModalClose: {
    fontSize: 22,
    color: '#6b7280',
  },
  editInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  editSaveButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  editSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
