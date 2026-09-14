// app/create-group.tsx
/**
 * Create Group Screen
 * Lets a member create a new BuddyPress group (name, description, privacy, type)
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../lib/auth';
import { useCreateGroup, useUploadGroupAvatar } from '../hooks/useGroups';
import BackButton from '../components/BackButton';

type PrivacyOption = 'public' | 'private' | 'hidden';
type GroupType = 'collaboration' | 'community' | 'networking' | 'research';

const PRIVACY_OPTIONS: { value: PrivacyOption; label: string; icon: keyof typeof Ionicons.glyphMap; helper: string }[] = [
  { value: 'public', label: 'Public', icon: 'earth-outline', helper: 'Anyone can see and join this group.' },
  { value: 'private', label: 'Private', icon: 'lock-closed-outline', helper: 'Anyone can find the group, but must request to join.' },
  { value: 'hidden', label: 'Hidden', icon: 'eye-off-outline', helper: 'Only members can find and see this group.' },
];

const TYPE_OPTIONS: { value: GroupType; label: string }[] = [
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'community', label: 'Community' },
  { value: 'networking', label: 'Networking' },
  { value: 'research', label: 'Research' },
];

export default function CreateGroupScreen() {
  const { token } = useAuth();
  const createGroupMutation = useCreateGroup(token);
  const uploadAvatarMutation = useUploadGroupAvatar(token);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PrivacyOption>('public');
  const [selectedTypes, setSelectedTypes] = useState<GroupType[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleType = (type: GroupType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const isValid = name.trim().length > 0 && description.trim().length > 0;

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const goToGroup = (createdId: number | undefined) => {
    // If the server response didn't include a usable id (seen once with an
    // unexpected response shape), fall back to My Groups instead of
    // navigating to a broken /group-detail?id=undefined.
    if (createdId) {
      router.replace(`/group-detail?id=${createdId}`);
    } else {
      router.replace('/profile/groups');
    }
  };

  const handleCreate = async () => {
    if (!isValid) {
      Alert.alert('Missing info', 'Please enter a group name and description.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newGroup = await createGroupMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        status,
        types: selectedTypes,
      });
      const createdName = newGroup?.name || name.trim();
      const createdId = newGroup?.id;

      // Photo upload is a separate request from group creation (the create
      // endpoint has no photo field) — if it fails, the group still exists,
      // so don't block navigation on it, just let the user know.
      if (avatarUri && createdId) {
        try {
          await uploadAvatarMutation.mutateAsync({ groupId: createdId, imageUri: avatarUri });
        } catch (avatarErr) {
          setIsSubmitting(false);
          // TEMP DIAGNOSTIC: figure out why the group avatar upload fails.
          console.log(
            '[GROUP AVATAR UPLOAD ERROR]',
            avatarErr instanceof Error ? avatarErr.message : avatarErr,
            (avatarErr as any)?.status
          );
          Alert.alert(
            'Group Created',
            `"${createdName}" was created, but the photo failed to upload. You can try adding it again from the group later.`,
            [{ text: 'OK', onPress: () => goToGroup(createdId) }]
          );
          return;
        }
      }

      setIsSubmitting(false);
      Alert.alert('Group Created', `"${createdName}" has been created!`, [
        { text: 'OK', onPress: () => goToGroup(createdId) },
      ]);
    } catch (err) {
      setIsSubmitting(false);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create group.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <BackButton />
            <Text style={styles.headerTitle}>Create Group</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Group Photo (optional) */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarPicker}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera-outline" size={26} color="#3b82f6" />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="pencil" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              {avatarUri ? 'Tap to change photo' : 'Add a group photo (optional)'}
            </Text>
          </View>

          {/* Name */}
          <Text style={styles.label}>Group Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Coral Restoration Enthusiasts"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          {/* Description */}
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What is this group about?"
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Privacy */}
          <Text style={styles.label}>Privacy</Text>
          <View style={{ gap: 10 }}>
            {PRIVACY_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.privacyOption, active && styles.privacyOptionActive]}
                  onPress={() => setStatus(opt.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={opt.icon} size={20} color={active ? '#2563eb' : '#6b7280'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.privacyLabel, active && styles.privacyLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.privacyHelper}>{opt.helper}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? '#2563eb' : '#d1d5db'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Type (optional) */}
          <Text style={styles.label}>Group Type (optional)</Text>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((opt) => {
              const active = selectedTypes.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleType(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, (!isValid || isSubmitting) && styles.submitButtonDisabled]}
            onPress={handleCreate}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Create Group</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatarPicker: { width: 96, height: 96 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#f3f4f6' },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 12, color: '#6b7280', marginTop: 8 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  textArea: { minHeight: 110 },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  privacyOptionActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  privacyLabel: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  privacyLabelActive: { color: '#1e40af' },
  privacyHelper: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  chipTextActive: { color: '#fff' },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 28,
  },
  submitButtonDisabled: { backgroundColor: '#93c5fd' },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
