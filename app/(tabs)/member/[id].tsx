import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import RequireAuth from '../../../components/RequireAuth';
import { useAuth } from '../../../lib/auth';
import { useMemberProfile } from '../../../hooks/useMemberProfile';
import { useSendFriendRequest } from '../../../hooks/useQueries';
import type { NormalizedXProfileField } from '../../../types';

const PRIMARY = '#0077b6';
const NAVY = '#002f6c';

const isResearchInterest = (f: NormalizedXProfileField) =>
  f.name.toLowerCase().includes('research interest');
const isAboutField = (f: NormalizedXProfileField) =>
  /\b(bio|about|biography|summary|description)\b/i.test(f.name);

function splitChips(value: string): string[] {
  return value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

function formatMemberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function FieldRow({ field, last }: { field: NormalizedXProfileField; last: boolean }) {
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowDivider]}>
      <Text style={styles.fieldLabel}>{field.name}</Text>
      <Text style={styles.fieldValue}>{field.value}</Text>
    </View>
  );
}

function SectionCard({ title, fields }: { title: string; fields: NormalizedXProfileField[] }) {
  if (!fields.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {fields.map((f, i) => (
        <FieldRow key={`${f.id}-${f.name}`} field={f} last={i === fields.length - 1} />
      ))}
    </View>
  );
}

function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(Array.isArray(id) ? id[0] : id) || null;
  const { userId: authUserId } = useAuth();
  const { member, fields, coverUrl, isLoading, isError, isRefetching, refetch } =
    useMemberProfile(memberId);
  const sendRequest = useSendFriendRequest();
  const [requestSent, setRequestSent] = useState(false);

  const { research, about, groups } = useMemo(() => {
    const research = fields.filter(isResearchInterest);
    const rest = fields.filter((f) => !isResearchInterest(f));
    const about = rest.filter(isAboutField);
    const others = rest.filter((f) => !isAboutField(f));
    const map = new Map<string, NormalizedXProfileField[]>();
    others.forEach((f) => {
      const key = f.group || 'Details';
      map.set(key, [...(map.get(key) ?? []), f]);
    });
    return { research, about, groups: Array.from(map.entries()) };
  }, [fields]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (isError || !member) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={40} color="#9ca3af" />
        <Text style={styles.errorText}>This member profile is not available.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/networking'))}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avatarUrl = member.avatar_urls?.full || member.avatar_urls?.thumb;
  const isOwn = authUserId != null && authUserId === member.id;
  const slug = member.friendship_status_slug;
  const status: 'connected' | 'pending' | 'none' =
    slug === 'is_friend'
      ? 'connected'
      : slug === 'pending' || slug === 'awaiting_response' || requestSent
        ? 'pending'
        : 'none';

  const since = formatMemberSince(member.registered_date);
  const chips: string[] = [];
  if (since) chips.push(`Member since ${since}`);
  if (member.last_activity?.timediff) chips.push(`Active ${member.last_activity.timediff}`);
  if (typeof member.total_friend_count === 'number') {
    chips.push(`${member.total_friend_count} ${member.total_friend_count === 1 ? 'connection' : 'connections'}`);
  }

  const handleConnect = async () => {
    try {
      await sendRequest.mutateAsync(member.id);
      setRequestSent(true);
    } catch (err) {
      Alert.alert('Error', `Failed to send request: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PRIMARY} />}
    >
      <View style={styles.banner}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.bannerImage} resizeMode="cover" /> : null}
      </View>

      <View style={styles.headerBlock}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{member.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.name}>{member.name}</Text>
        {member.mention_name ? <Text style={styles.mention}>@{member.mention_name}</Text> : null}

        {chips.length > 0 && (
          <View style={styles.chipRow}>
            {chips.map((c) => (
              <View key={c} style={styles.statChip}>
                <Text style={styles.statChipText}>{c}</Text>
              </View>
            ))}
          </View>
        )}

        {!isOwn && (
          <View style={styles.actionRow}>
            {status === 'none' && (
              <TouchableOpacity
                style={[styles.primaryButton, styles.actionButton]}
                onPress={handleConnect}
                disabled={sendRequest.isPending}
                activeOpacity={0.8}
              >
                {sendRequest.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={16} color="#fff" />
                    <Text style={styles.primaryButtonText}>Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {status === 'pending' && (
              <View style={[styles.outlineButton, styles.actionButton, styles.disabled]}>
                <Ionicons name="time-outline" size={16} color={PRIMARY} />
                <Text style={styles.outlineButtonText}>Pending</Text>
              </View>
            )}
            {status === 'connected' && (
              <View style={[styles.outlineButton, styles.actionButton]}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text style={styles.outlineButtonText}>Connected</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.outlineButton, styles.actionButton]}
              onPress={() => router.push({ pathname: '/messages/new', params: { userId: String(member.id) } })}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={16} color={PRIMARY} />
              <Text style={styles.outlineButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.sections}>
        {research.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Research Interests</Text>
            {research.map((f, i) => (
              <View key={`${f.id}-${f.name}`} style={[styles.fieldRow, i < research.length - 1 && styles.fieldRowDivider]}>
                <Text style={styles.fieldLabel}>{f.name}</Text>
                <View style={styles.tagWrap}>
                  {splitChips(f.value).map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
        <SectionCard title="About" fields={about} />
        {groups.map(([name, list]) => (
          <SectionCard key={name} title={name} fields={list} />
        ))}
        {fields.length === 0 && (
          <Text style={styles.emptyText}>This member hasn't shared any profile details yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

export default function MemberProfileRoute() {
  return (
    <RequireAuth>
      <MemberProfileScreen />
    </RequireAuth>
  );
}

const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: {},
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, backgroundColor: '#f9fafb' },
  errorText: { fontSize: 16, color: '#374151', textAlign: 'center' },
  banner: { height: 160, backgroundColor: NAVY },
  bannerImage: { width: '100%', height: '100%' },
  headerBlock: { alignItems: 'center', paddingHorizontal: 16, marginTop: -48 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#fff', backgroundColor: '#e5e7eb' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '700' },
  name: { marginTop: 10, fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  mention: { marginTop: 2, fontSize: 14, color: '#6b7280' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  statChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  statChipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  actionButton: { flex: 1 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, backgroundColor: PRIMARY },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  outlineButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: PRIMARY, backgroundColor: '#fff' },
  outlineButtonText: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  sections: { paddingHorizontal: 16, marginTop: 20, gap: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, ...cardShadow },
  cardTitle: { fontSize: 17, fontWeight: '800', color: NAVY, marginBottom: 8 },
  fieldRow: { paddingVertical: 10 },
  fieldRowDivider: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  fieldValue: { fontSize: 15, color: '#111827', lineHeight: 21 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e0f2fe' },
  tagText: { fontSize: 14, color: '#075985', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#6b7280', fontSize: 14 },
});
