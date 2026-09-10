// app/(tabs)/member/[id].tsx
/**
 * Extended member profile — photo, cover/banner, name, and Hub xprofile
 * fields (primary/secondary research interests and the rest of Base).
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMember, useUserCover } from '../../../hooks/useProfile';
import { useSendFriendRequest } from '../../../hooks/useQueries';
import {
  getExtendedProfileFields,
  getFeaturedResearchFields,
  getRemainingProfileFields,
} from '../../../lib/xprofile';

const PRIMARY = '#0066cc';

export default function MemberProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const memberId = Number(params.id);
  const validId = Number.isFinite(memberId) && memberId > 0 ? memberId : 0;

  const { userId } = useAuth();
  const { data: member, isLoading, error, refetch } = useMember(validId);
  const { data: cover } = useUserCover(validId);
  const sendFriendMutation = useSendFriendRequest();
  const [refreshing, setRefreshing] = useState(false);

  const fields = useMemo(() => getExtendedProfileFields(member), [member]);
  const researchFields = useMemo(() => getFeaturedResearchFields(fields), [fields]);
  const otherFields = useMemo(() => getRemainingProfileFields(fields), [fields]);

  const isSelf = Boolean(userId && validId && Number(userId) === validId);
  const statusSlug = String(member?.friendship_status_slug || '');
  const isFriend = statusSlug === 'is_friend';
  const requestPending =
    statusSlug === 'pending' || statusSlug === 'awaiting_response';

  const avatarUrl = member?.avatar_urls?.full || member?.avatar_urls?.thumb;
  const coverUrl = cover?.image || '';
  const description = otherFields.find((field) =>
    field.name.toLowerCase().includes('general description')
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleConnect = async () => {
    if (!member) return;
    try {
      await sendFriendMutation.mutateAsync(member.id);
      await refetch();
      Alert.alert('Request Sent', `Friend request sent to ${member.name}.`);
    } catch (err) {
      Alert.alert(
        'Error',
        `Failed to send request: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  if (!validId) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Text style={styles.errorTitle}>Member not found</Text>
      </View>
    );
  }

  if (isLoading && !member) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.muted}>Loading profile…</Text>
      </View>
    );
  }

  if (error || !member) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Couldn’t load this profile</Text>
        <Text style={styles.muted}>
          {error instanceof Error ? error.message : 'Please try again.'}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: member.name }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />
        }
      >
        <View style={styles.hero}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={styles.coverFallback} />
          )}
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(member.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.identity}>
          <Text style={styles.name}>{member.name}</Text>
          {description ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{description.value}</Text>
            </View>
          ) : null}
          {member.last_activity?.timediff ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text style={styles.metaText}>Active {member.last_activity.timediff}</Text>
            </View>
          ) : null}

          {!isSelf && (
            <View style={styles.actions}>
              {isFriend ? (
                <View style={styles.statusPill}>
                  <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                  <Text style={styles.statusText}>Connected</Text>
                </View>
              ) : requestPending ? (
                <View style={[styles.statusPill, styles.pendingPill]}>
                  <Ionicons name="time-outline" size={16} color={PRIMARY} />
                  <Text style={[styles.statusText, { color: PRIMARY }]}>Request pending</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleConnect}
                  disabled={sendFriendMutation.isPending}
                  activeOpacity={0.8}
                >
                  {sendFriendMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={16} color="#fff" />
                      <Text style={styles.connectText}>Connect</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {researchFields.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Research interests</Text>
            {researchFields.map((field) => (
              <View key={field.id || field.name} style={styles.researchCard}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.researchValue}>{field.value}</Text>
              </View>
            ))}
          </View>
        )}

        {otherFields.filter((field) => field !== description).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            {otherFields
              .filter((field) => field !== description)
              .map((field) => (
                <View key={field.id || field.name} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue}>{field.value}</Text>
                </View>
              ))}
          </View>
        )}

        {fields.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>This member hasn’t filled in their extended profile yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
    gap: 8,
  },
  hero: { backgroundColor: '#fff' },
  cover: { width: '100%', height: 160, backgroundColor: '#dbeafe' },
  coverFallback: { width: '100%', height: 160, backgroundColor: '#1e3a5f' },
  avatarWrap: { alignItems: 'center', marginTop: -48 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#e5e7eb',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3a5f' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#fff' },
  identity: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  name: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center' },
  chip: {
    marginTop: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { color: PRIMARY, fontWeight: '700', fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  metaText: { color: '#6b7280', fontSize: 13 },
  actions: { marginTop: 16 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  connectText: { color: '#fff', fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pendingPill: { backgroundColor: '#eff6ff' },
  statusText: { color: '#15803d', fontWeight: '700' },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  researchCard: {
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
  },
  researchValue: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 4 },
  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 4 },
  fieldValue: { fontSize: 16, color: '#111827', lineHeight: 22 },
  emptyCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  muted: { color: '#6b7280', textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 8 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
});
