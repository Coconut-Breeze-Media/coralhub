import React, { useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useSharePost } from '../hooks/useActivity';

type ShareButtonProps = {
  activityId: number;
  postUrl: string;
  variant?: 'inline' | 'filled';
  style?: any;
  iconColor?: string;
  textColor?: string;
  previewAuthorName?: string;
  previewAuthorAvatarUrl?: string;
  previewTimeLabel?: string;
  previewText?: string;
  previewImageUrl?: string;
  previewLinkUrl?: string;
};

export default function ShareButton({
  activityId,
  postUrl,
  variant = 'inline',
  style,
  iconColor,
  textColor,
  previewAuthorName,
  previewAuthorAvatarUrl,
  previewTimeLabel,
  previewText,
  previewImageUrl,
  previewLinkUrl,
}: ShareButtonProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const sharePostMutation = useSharePost(token);
  const [modalVisible, setModalVisible] = useState(false);
  const [comment, setComment] = useState('');
  const [isShareSubmitting, setIsShareSubmitting] = useState(false);
  const shareSubmitLockRef = useRef(false);
  const isShareInProgress = sharePostMutation.isPending || isShareSubmitting;

  const closeModal = () => {
    if (isShareInProgress) return;
    setModalVisible(false);
    setComment('');
  };

  const resetAndCloseModal = () => {
    setModalVisible(false);
    setComment('');
  };

  const normalizedLink = useMemo(() => {
    const candidate = (previewLinkUrl || postUrl || '').trim();
    if (!candidate) return '';
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) return candidate;
    return `https://${candidate}`;
  }, [postUrl, previewLinkUrl]);

  const linkHostname = useMemo(() => {
    if (!normalizedLink) return '';
    try {
      return new URL(normalizedLink).hostname.replace(/^www\./, '');
    } catch {
      return normalizedLink;
    }
  }, [normalizedLink]);

  const hasPreviewContent = !!(
    previewText?.trim() ||
    previewImageUrl?.trim() ||
    normalizedLink
  );

  const handleShare = async () => {
    if (shareSubmitLockRef.current || isShareInProgress) {
      return;
    }

    if (!postUrl) {
      Alert.alert('Error', 'Missing post URL');
      return;
    }

    shareSubmitLockRef.current = true;
    setIsShareSubmitting(true);

    try {
      await sharePostMutation.mutateAsync({
        activityId,
        postUrl,
        content: comment.trim() ? comment.trim() : undefined,
      });
      resetAndCloseModal();
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['activity', 'feed'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['groups', 'activity'], type: 'active' }),
      ]);
      Alert.alert('Success', 'Post shared successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to share post');
    } finally {
      shareSubmitLockRef.current = false;
      setIsShareSubmitting(false);
    }
  };

  const buttonStyle =
    variant === 'filled'
      ? {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: 6,
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: '#2563eb',
        }
      : {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: 6,
          paddingVertical: 8,
        };

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        disabled={isShareInProgress}
        style={[buttonStyle, style, isShareInProgress ? { opacity: 0.6 } : null]}
      >
        <Ionicons
          name="share-social-outline"
          size={18}
          color={iconColor || (variant === 'filled' ? '#fff' : '#6b7280')}
        />
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: textColor || (variant === 'filled' ? '#fff' : '#6b7280'),
          }}
        >
          Share
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              maxHeight: '86%',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Share Activity</Text>
              <TouchableOpacity
                onPress={closeModal}
                disabled={isShareInProgress}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f3f4f6',
                }}
              >
                <Ionicons name="close" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 560 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                value={comment}
                onChangeText={setComment}
                multiline
                placeholder="What do you want to say about this?"
                placeholderTextColor="#9ca3af"
                editable={!isShareInProgress}
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 10,
                  minHeight: 96,
                  textAlignVertical: 'top',
                  padding: 12,
                  fontSize: 14,
                  color: '#111827',
                }}
              />

              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 12,
                  backgroundColor: '#f9fafb',
                  overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                  {previewAuthorAvatarUrl ? (
                    <Image
                      source={{ uri: previewAuthorAvatarUrl }}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#e5e7eb',
                      }}
                    >
                      <Ionicons name="person" size={18} color="#6b7280" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                      {previewAuthorName || 'Post'}
                    </Text>
                    {previewTimeLabel ? (
                      <Text style={{ fontSize: 12, color: '#6b7280' }} numberOfLines={1}>
                        {previewTimeLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {hasPreviewContent ? (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                    {previewText?.trim() ? (
                      <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 }}>
                        {previewText.trim()}
                      </Text>
                    ) : null}

                    {previewImageUrl ? (
                      <Image
                        source={{ uri: previewImageUrl }}
                        style={{ width: '100%', height: 210, borderRadius: 10, backgroundColor: '#e5e7eb', marginBottom: normalizedLink ? 10 : 0 }}
                        resizeMode="cover"
                      />
                    ) : null}

                    {normalizedLink ? (
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: '#dbeafe',
                          backgroundColor: '#eff6ff',
                          borderRadius: 10,
                          padding: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Ionicons name="link" size={15} color="#2563eb" />
                        <Text style={{ flex: 1, fontSize: 13, color: '#1d4ed8' }} numberOfLines={1}>
                          {linkHostname || normalizedLink}
                        </Text>
                        <Ionicons name="open-outline" size={15} color="#2563eb" />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>No preview available for this post.</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
              }}
            >
              <TouchableOpacity
                onPress={closeModal}
                disabled={isShareInProgress}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 11,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#4b5563' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                disabled={isShareInProgress}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 11,
                  borderRadius: 10,
                  backgroundColor: '#2563eb',
                  opacity: isShareInProgress ? 0.7 : 1,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  {isShareInProgress ? 'Sharing...' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
