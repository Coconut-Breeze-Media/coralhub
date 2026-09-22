// app/profile/settings.tsx
/**
 * Profile Settings Screen
 * Allows users to view and edit their profile information including:
 * - Display name
 * - Profile picture (avatar)
 * - Cover image
 */

import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  useCurrentMember,
  useUpdateProfile,
  useUploadAvatar,
  useDeleteAvatar,
  useUploadCover,
  useDeleteCover,
  useUserAvatar,
  useUserCover,
  useUserActivity,
} from '../../hooks';
import BackButton from '../../components/BackButton';
import { optimizeCoverImage } from '../../lib/imageHelpers';
import { useAuth } from '../../lib/auth';

const COVER_ASPECT: [number, number] = [27, 7];
const COVER_UPLOAD_WIDTH = 1400;

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: member, isLoading, error, refetch: refetchMember } = useCurrentMember();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const uploadCover = useUploadCover();
  const deleteCover = useDeleteCover();
  // Covers are not part of the member/xprofile payload. Read BuddyPress's
  // dedicated media endpoints so the settings page shows the actual uploads.
  const { data: avatar, refetch: refetchAvatar } = useUserAvatar(member?.id || 0);
  const { data: cover, refetch: refetchCover } = useUserCover(member?.id || 0);
  const { data: activities } = useUserActivity(member?.id || 0);

  const [displayName, setDisplayName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  // WordPress keeps the same media URL after replacing an image. Keep the
  // returned URL and a version so React Native's image cache loads the new file.
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string>();
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string>();
  const [mediaVersion, setMediaVersion] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const refreshProfileMedia = async (type: 'avatar' | 'cover') => {
    const version = Date.now();
    setMediaVersion(version);

    console.log('[ProfileMedia][refresh] Refreshing profile after upload', {
      type,
      userId: member?.id ?? null,
      version,
    });

    try {
      const memberPromise = refetchMember();
      const [memberResult, mediaResult] = type === 'avatar'
        ? await Promise.all([memberPromise, refetchAvatar()])
        : await Promise.all([memberPromise, refetchCover()]);

      if (memberResult.error || mediaResult.error) {
        console.warn('[ProfileMedia][refresh] Profile refetch returned an error', {
          type,
          memberError: memberResult.error ?? null,
          mediaError: mediaResult.error ?? null,
        });
      } else {
        const mediaUrl = type === 'avatar'
          ? (mediaResult.data as { full?: string; thumb?: string } | undefined)?.full
            || (mediaResult.data as { full?: string; thumb?: string } | undefined)?.thumb
            || null
          : (mediaResult.data as { image?: string } | undefined)?.image || null;

        console.log('[ProfileMedia][refresh] Profile data refreshed', {
          type,
          userId: memberResult.data?.id ?? member?.id ?? null,
          mediaUrl,
        });
      }
    } catch (refreshError) {
      // The upload already succeeded; preserve the newly returned URL even if
      // the follow-up profile read is temporarily unavailable.
      console.warn('[ProfileMedia][refresh] Unable to refetch profile', {
        type,
        error: refreshError,
      });
    }
  };

  // Initialize display name when member data loads
  if (member && !displayName && !isEditing) {
    setDisplayName(member.name || '');
  }

  // Request permissions on mount
  const requestPermissions = async () => {
    console.log('[ProfileMedia][permission] Checking media library permission', {
      platform: Platform.OS,
    });

    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[ProfileMedia][permission] Media library permission result', { status });

      if (status !== 'granted') {
        console.warn('[ProfileMedia][permission] Media library access was not granted');
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to change your profile picture.'
        );
        return false;
      }
    }
    return true;
  };

  const handlePickImage = async (type: 'avatar' | 'cover') => {
    console.log('[ProfileMedia][picker] Change image pressed', {
      type,
      userId: member?.id ?? null,
    });

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('[ProfileMedia][picker] Picker stopped because permission is missing', { type });
      return;
    }

    try {
      console.log('[ProfileMedia][picker] Opening image library', {
        type,
        aspect: type === 'avatar' ? [1, 1] : COVER_ASPECT,
        quality: 0.8,
      });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        // Profile media accepts one image only; cover/avatar upload endpoints
        // expect a single multipart file.
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : COVER_ASPECT,
        quality: 0.8,
      });

      console.log('[ProfileMedia][picker] Image library closed', {
        type,
        canceled: result.canceled,
        assetCount: result.assets?.length ?? 0,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        console.log('[ProfileMedia][picker] Image selected', {
          type,
          fileName: asset.fileName ?? null,
          fileSize: asset.fileSize ?? null,
          mimeType: asset.mimeType ?? null,
          width: asset.width,
          height: asset.height,
          uriScheme: asset.uri.split(':')[0] || 'file',
        });

        if (type === 'avatar') {
          await handleUploadAvatar(asset.uri);
        } else {
          console.log('[ProfileMedia][cover] Resizing image before upload', {
            sourceWidth: asset.width,
            sourceHeight: asset.height,
            targetWidth: COVER_UPLOAD_WIDTH,
            targetAspect: COVER_ASPECT,
          });
          const preparedImageUri = await optimizeCoverImage(asset.uri, COVER_UPLOAD_WIDTH);
          console.log('[ProfileMedia][cover] Image prepared for upload', {
            targetWidth: COVER_UPLOAD_WIDTH,
            uriScheme: preparedImageUri.split(':')[0] || 'file',
          });
          await handleUploadCover(preparedImageUri);
        }
      } else {
        console.log('[ProfileMedia][picker] No image selected', { type });
      }
    } catch (error) {
      console.error('[ProfileMedia][picker] Failed to select or upload image', { type, error });
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleUploadAvatar = async (imageUri: string) => {
    if (!member?.id) {
      console.warn('[ProfileMedia][avatar] Upload skipped because member ID is missing');
      return;
    }

    try {
      console.log('[ProfileMedia][avatar] Starting upload', {
        userId: member.id,
        platform: Platform.OS,
        uriScheme: imageUri.split(':')[0] || 'file',
      });

      const response = await uploadAvatar.mutateAsync({ 
        userId: member.id, 
        imageUri 
      });

      console.log('[ProfileMedia][avatar] Upload completed', {
        userId: member.id,
        response,
      });

      setUploadedAvatarUrl(response.full || response.thumb || undefined);
      await refreshProfileMedia('avatar');

      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('[ProfileMedia][avatar] Upload failed', {
        userId: member.id,
        status: error?.status ?? null,
        message: error?.message ?? String(error),
        error,
      });

      let errorMessage = 'Failed to update profile picture';
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleUploadCover = async (imageUri: string) => {
    if (!member?.id) {
      console.warn('[ProfileMedia][cover] Upload skipped because member ID is missing');
      return;
    }

    try {
      console.log('[ProfileMedia][cover] Preparing upload', {
        userId: member.id,
        platform: Platform.OS,
        uriScheme: imageUri.split(':')[0] || 'file',
      });

      // Create form data for cover (keeping old implementation for now)
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
        formData.append('file', file);

        console.log('[ProfileMedia][cover] Web file added to FormData', {
          name: file.name,
          type: file.type,
          size: file.size,
        });
      } else {
        const filename = imageUri.split('/').pop() || 'cover.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const fileType = match ? `image/${match[1]}` : 'image/jpeg';

        // @ts-ignore - FormData append is different in React Native
        formData.append('file', {
          uri: imageUri,
          name: filename,
          type: fileType,
        });

        console.log('[ProfileMedia][cover] Native file added to FormData', {
          name: filename,
          type: fileType,
        });
      }

      console.log('[ProfileMedia][cover] Starting upload', { userId: member.id });
      const response = await uploadCover.mutateAsync({ userId: member.id, formData });

      console.log('[ProfileMedia][cover] Upload completed', {
        userId: member.id,
        response,
      });

      setUploadedCoverUrl(response.image || undefined);
      await refreshProfileMedia('cover');

      Alert.alert('Success', 'Cover image updated successfully');
    } catch (error: any) {
      console.error('[ProfileMedia][cover] Upload failed', {
        userId: member.id,
        status: error?.status ?? null,
        message: error?.message ?? String(error),
        error,
      });

      let errorMessage = 'Failed to update cover image';
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      if (error?.status === 500) {
        errorMessage += '\n\nThis may be due to:\n• Image dimensions (cover requires ~1300x225px)\n• File size too large\n• Server configuration issues';
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleDeleteImage = async (type: 'avatar' | 'cover') => {
    if (!member?.id) return;

    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete your ${type === 'avatar' ? 'profile picture' : 'cover image'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (type === 'avatar') {
                await deleteAvatar.mutateAsync(member.id);
                setUploadedAvatarUrl(undefined);
              } else {
                await deleteCover.mutateAsync(member.id);
                setUploadedCoverUrl(undefined);
              }
              await refreshProfileMedia(type);
              Alert.alert('Success', `${type === 'avatar' ? 'Profile picture' : 'Cover image'} deleted`);
            } catch (error) {
              Alert.alert('Error', `Failed to delete ${type === 'avatar' ? 'profile picture' : 'cover image'}`);
            }
          },
        },
      ]
    );
  };

  const handleSaveName = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    try {
      await updateProfile.mutateAsync({ name: displayName.trim() });
      setIsEditing(false);
      Alert.alert('Success', 'Display name updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update display name');
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={{ fontSize: 18, color: '#1f2937', marginTop: 16, textAlign: 'center' }}>
          Failed to load profile
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
          {error.message}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 24,
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: '#2563eb',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const avatarUrl = uploadedAvatarUrl || avatar?.full || avatar?.thumb || member?.avatar_urls?.full || member?.avatar_urls?.thumb;
  // BuddyPress uses this file as the default avatar. It is not an uploaded
  // profile picture, so users should not be offered a delete action for it.
  const hasCustomAvatar = avatarUrl
    ? !/\/Please-Upload-Avatar-Image\.(?:jpe?g|png|gif)(?:[?#]|$)/i.test(avatarUrl)
    : false;
  // Covers are stored by BuddyPress, not in xprofile. Avoid an old xprofile
  // value keeping the delete button visible after the image is removed.
  const coverUrl = uploadedCoverUrl || cover?.image;
  const hasCover = Boolean(coverUrl);
  const addMediaVersion = (url?: string) => {
    if (!url) return undefined;
    return `${url}${url.includes('?') ? '&' : '?'}profile_media=${mediaVersion}`;
  };
  const avatarImageUrl = addMediaVersion(avatarUrl);
  const coverImageUrl = addMediaVersion(coverUrl);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header with Back Button */}
        <View
          style={{
            backgroundColor: '#fff',
            paddingTop: Platform.OS === 'ios' ? 60 : 20,
            paddingBottom: 16,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BackButton />
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#1f2937', marginLeft: 16 }}>
              Profile Settings
            </Text>
          </View>
        </View>

        {/* Cover Image Section */}
        <View style={{ backgroundColor: '#fff', marginBottom: 2 }}>
          <View
            style={{
              height: 160,
              backgroundColor: '#e5e7eb',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {coverImageUrl ? (
              <Image key={coverImageUrl} source={{ uri: coverImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Ionicons name="image-outline" size={48} color="#9ca3af" />
            )}
          </View>
          <View style={{ flexDirection: 'row', padding: 12, gap: 12 }}>
            <Pressable
              onPress={() => handlePickImage('cover')}
              disabled={uploadCover.isPending}
              style={{
                flex: 1,
                paddingVertical: 10,
                backgroundColor: '#2563eb',
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              {uploadCover.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  {hasCover ? 'Change Cover' : 'Add Cover'}
                </Text>
              )}
            </Pressable>
            {hasCover && (
              <Pressable
                onPress={() => handleDeleteImage('cover')}
                disabled={deleteCover.isPending}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  backgroundColor: '#ef4444',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                {deleteCover.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Avatar Section */}
        <View style={{ backgroundColor: '#fff', padding: 16, marginBottom: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>
            Profile Picture
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#e5e7eb',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              {avatarImageUrl ? (
                <Image key={avatarImageUrl} source={{ uri: avatarImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Ionicons name="person" size={40} color="#9ca3af" />
              )}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => handlePickImage('avatar')}
                  disabled={uploadAvatar.isPending || deleteAvatar.isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    backgroundColor: '#2563eb',
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  {uploadAvatar.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                      {hasCustomAvatar ? 'Change Picture' : 'Add Picture'}
                    </Text>
                  )}
                </Pressable>
                {hasCustomAvatar && (
                  <Pressable
                    onPress={() => handleDeleteImage('avatar')}
                    disabled={uploadAvatar.isPending || deleteAvatar.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Delete profile picture"
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      backgroundColor: '#ef4444',
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                  >
                    {deleteAvatar.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Display Name Section */}
        <View style={{ backgroundColor: '#fff', padding: 16, marginBottom: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>
            Display Name
          </Text>
          {isEditing ? (
            <>
              <TextInput
                autoFocus
                value={displayName}
                onChangeText={setDisplayName}
                onFocus={() => {
                  // Wait for the keyboard animation, then keep the editor and
                  // its Save/Cancel controls inside the visible scroll area.
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 250);
                }}
                placeholder="Enter your display name"
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  color: '#1f2937',
                  backgroundColor: '#fff',
                }}
              />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Pressable
                onPress={() => {
                  setDisplayName(member?.name || '');
                  setIsEditing(false);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#6b7280', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveName}
                disabled={updateProfile.isPending}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  backgroundColor: '#2563eb',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                {updateProfile.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Save</Text>
                )}
              </Pressable>
            </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, fontSize: 16, color: '#1f2937' }}>
                {member?.name || 'N/A'}
              </Text>
              <Pressable
                onPress={() => {
                  setDisplayName(member?.name || '');
                  setIsEditing(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit display name"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: '#2563eb',
                  borderRadius: 8,
                }}
              >
                <Ionicons name="pencil-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Edit</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* User Info (Read-only) */}
        <View style={{ backgroundColor: '#fff', padding: 16, marginBottom: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>
            Account Information
          </Text>
          <View style={{ gap: 12 }}>
            <View>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Username</Text>
              <Text style={{ fontSize: 16, color: '#1f2937' }}>
                {member?.user_login || member?.mention_name || 'N/A'}
              </Text>
            </View>
            {profile?.user_email && (
              <View>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Email</Text>
                <Text style={{ fontSize: 16, color: '#1f2937' }}>{profile.user_email}</Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Last Activity</Text>
              {activities && activities.length > 0 ? (
                <>
                  <Text style={{ fontSize: 16, color: '#1f2937', fontWeight: '600' }}>
                    {activities[0].type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>
                    {new Date(activities[0].date_recorded || activities[0].date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 16, color: '#1f2937' }}>No activity recorded</Text>
              )}
            </View>
            {member?.registered_date && (
              <View>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Member Since</Text>
                <Text style={{ fontSize: 16, color: '#1f2937' }}>
                  {new Date(member.registered_date).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
