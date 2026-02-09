// app/profile/settings.tsx
/**
 * Profile Settings Screen
 * Allows users to view and edit their profile information including:
 * - Display name
 * - Profile picture (avatar)
 * - Cover image
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
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
  useUserActivity,
} from '../../hooks';
import BackButton from '../../components/BackButton';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { data: member, isLoading, error } = useCurrentMember();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const uploadCover = useUploadCover();
  const deleteCover = useDeleteCover();
  const { data: activities } = useUserActivity(member?.id || 0);

  const [displayName, setDisplayName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Initialize display name when member data loads
  if (member && !displayName && !isEditing) {
    setDisplayName(member.name || '');
  }

  // Request permissions on mount
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
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
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        if (type === 'avatar') {
          await handleUploadAvatar(asset.uri);
        } else {
          await handleUploadCover(asset.uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleUploadAvatar = async (imageUri: string) => {
    if (!member?.id) return;

    try {
      console.log('📤 Starting avatar upload for user', member.id);
      console.log('📷 Image URI:', imageUri);
      
      const response = await uploadAvatar.mutateAsync({ 
        userId: member.id, 
        imageUri 
      });
      
      console.log('✅ Avatar uploaded successfully');
      console.log('Avatar URLs:', response.full, response.thumb);
      
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('❌ Error uploading avatar:', error);
      
      let errorMessage = 'Failed to update profile picture';
      if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleUploadCover = async (imageUri: string) => {
    if (!member?.id) return;

    try {
      console.log('📤 Starting cover upload for user', member.id);
      console.log('📷 Image URI:', imageUri);
      
      // Create form data for cover (keeping old implementation for now)
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
        formData.append('file', file);
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
      }
      
      await uploadCover.mutateAsync({ userId: member.id, formData });
      console.log('✅ Cover uploaded successfully');
      
      Alert.alert('Success', 'Cover image updated successfully');
    } catch (error: any) {
      console.error('❌ Error uploading cover:', error);
      
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
              } else {
                await deleteCover.mutateAsync(member.id);
              }
              Alert.alert('Success', `${type === 'avatar' ? 'Profile picture' : 'Cover image'} deleted`);
            } catch (error) {
              console.error(`Error deleting ${type}:`, error);
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
      console.error('Error updating name:', error);
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

  const avatarUrl = member?.avatar_urls?.full || member?.avatar_urls?.thumb;
  const coverUrl = Array.isArray(member?.xprofile) 
    ? member.xprofile.find((field) => field.name.toLowerCase().includes('cover'))?.value.raw 
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView>
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
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
                  {coverUrl ? 'Change Cover' : 'Add Cover'}
                </Text>
              )}
            </Pressable>
            {coverUrl && (
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
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Ionicons name="person" size={40} color="#9ca3af" />
              )}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Pressable
                onPress={() => handlePickImage('avatar')}
                disabled={uploadAvatar.isPending}
                style={{
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
                    {avatarUrl ? 'Change Picture' : 'Add Picture'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Display Name Section */}
        <View style={{ backgroundColor: '#fff', padding: 16, marginBottom: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>
            Display Name
          </Text>
          <TextInput
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              setIsEditing(true);
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
          {isEditing && (
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
            <View>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Member ID</Text>
              <Text style={{ fontSize: 16, color: '#1f2937' }}>{member?.id}</Text>
            </View>
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
    </View>
  );
}
