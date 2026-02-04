import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { getMe, updateUser } from '../../lib/api';
import { WPUser } from '../../types';

const PRIMARY = '#0077b6';

export default function ProfileSettingsScreen() {
  const { token, updateProfile, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<Partial<WPUser>>({});

  useEffect(() => {
    loadUserData();
  }, [token]);

  async function loadUserData() {
    if (!token) return;
    try {
      setLoading(true);
      const user = await getMe(token);
      setUserData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        description: user.description || '',
        name: user.name || '',
      });
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load profile data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!token) return;
    try {
      setSaving(true);
      // Construct the update payload
      const updateData: Partial<WPUser> = {
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        description: userData.description,
        name: `${userData.first_name} ${userData.last_name}`.trim() || userData.name,
      };

      const updatedUser = await updateUser(token, updateData);

      // Update local context
      await updateProfile({
        user_email: updatedUser.email || profile?.user_email || '',
        user_display_name: updatedUser.name || profile?.user_display_name || '',
      });

      Alert.alert('Success', 'Profile updated successfully');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Profile Settings' }} />
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: 'Profile Settings', headerBackVisible: true }} />
      <ScrollView contentContainerStyle={styles.container}>

        <View style={styles.formGroup}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={userData.first_name}
            onChangeText={(text) => setUserData(prev => ({ ...prev, first_name: text }))}
            placeholder="First Name"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={userData.last_name}
            onChangeText={(text) => setUserData(prev => ({ ...prev, last_name: text }))}
            placeholder="Last Name"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={userData.email}
            onChangeText={(text) => setUserData(prev => ({ ...prev, email: text }))}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Bio / Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={userData.description}
            onChangeText={(text) => setUserData(prev => ({ ...prev, description: text }))}
            placeholder="Tell us about yourself..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    gap: 20,
    paddingBottom: 50,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
  },
  saveButton: {
    backgroundColor: PRIMARY,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
