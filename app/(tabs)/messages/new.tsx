import { useMemo, useState } from 'react';
import {
  Text,
  TextInput,
  FlatList,
  Pressable,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMembersList } from '../../../hooks/useMembers';
import { useSendMessage } from '../../../hooks/useMessages';
import type { BPMember } from '../../../types';
import {
  applyComposerFormat,
  MessageFormattingToolbar,
  type ComposerSelection,
} from '../../../components/MessageFormattingToolbar';

function getInitial(name: string): string {
  const safeName = name.trim();
  return safeName ? safeName[0].toUpperCase() : 'M';
}

export default function NewMessageScreen() {
  const { token } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<BPMember | null>(null);
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<ComposerSelection>({
    start: 0,
    end: 0,
  });
  const sendMessageMutation = useSendMessage(token);
  const isSending = sendMessageMutation.isPending;
  const { data, isLoading, error } = useMembersList(token, {
    search,
    page: 1,
    perPage: 20,
  });
  const members = Array.isArray(data) ? data : [];
  const canSend = !!selectedMember && !!message.trim() && !isSending;
  const trimmedSearch = search.trim();
  const emptyTitle = useMemo(
    () => (trimmedSearch ? 'No matching members' : 'No members to show'),
    [trimmedSearch]
  );
  const emptyDescription = useMemo(
    () =>
      trimmedSearch
        ? `We could not find anyone matching "${trimmedSearch}". Try another name or username.`
        : 'Start by searching for a member you want to message.',
    [trimmedSearch]
  );

  function handleFormatAction(action: Parameters<typeof applyComposerFormat>[2]) {
    const next = applyComposerFormat(message, selection, action);
    setMessage(next.text);
    requestAnimationFrame(() => {
      setSelection(next.selection);
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: '#f8fafc' }}>
      <Stack.Screen options={{ title: 'New Message' }} />
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          marginBottom: 16,
          color: '#0f172a',
        }}
      >
        New Message
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search members..."
        style={{
          borderWidth: 1,
          borderColor: '#d1d5db',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 16,
          backgroundColor: '#ffffff',
        }}
      />

      <View style={{ flex: 1 }}>
        {isLoading && <Text>Loading members...</Text>}

        {error && <Text>Error loading members</Text>}

        <FlatList
          data={members}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 12,
            flexGrow: members.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={
            !isLoading && !error ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  padding: 16,
                  backgroundColor: '#ffffff',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#e0f2fe',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#0369a1' }}>
                    {trimmedSearch ? '?' : 'M'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: 4,
                    fontSize: 17,
                    textAlign: 'center',
                  }}
                >
                  {emptyTitle}
                </Text>
                <Text style={{ color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
                  {emptyDescription}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isSelected = selectedMember?.id === item.id;

            return (
              <Pressable
                onPress={() => setSelectedMember(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderWidth: 1,
                  borderColor: isSelected ? '#0284c7' : '#e5e7eb',
                  backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                  borderRadius: 16,
                  marginBottom: 12,
                  shadowColor: '#0f172a',
                  shadowOpacity: isSelected ? 0.08 : 0.04,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 1,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: isSelected ? '#bae6fd' : '#e0f2fe',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: '#0369a1',
                    }}
                  >
                    {getInitial(item.name)}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontWeight: '700',
                      color: '#0f172a',
                      fontSize: 16,
                      marginBottom: 2,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#64748b',
                      fontSize: 13,
                    }}
                  >
                    {isSelected ? 'Selected recipient' : 'Tap to start a private message'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      {selectedMember && (
        <View style={{ marginTop: 12 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: '#bae6fd',
              backgroundColor: '#f0f9ff',
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#0369a1',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Selected recipient
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
              {selectedMember.name}
            </Text>
          </View>

          <TextInput
            value={message}
            onChangeText={setMessage}
            onSelectionChange={(event) => {
              setSelection(event.nativeEvent.selection);
            }}
            placeholder="Type your message..."
            multiline
            selection={selection}
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 12,
              minHeight: 96,
              maxHeight: 160,
              backgroundColor: '#ffffff',
            }}
          />

          <MessageFormattingToolbar onActionPress={handleFormatAction} />

          <Pressable
            disabled={!canSend}
            onPress={() => {
              if (!selectedMember || !message.trim()) return;

              sendMessageMutation.mutate({
                recipients: [selectedMember.id],
                subject: 'New Message',
                message,
              });

              setMessage('');
              setSelection({ start: 0, end: 0 });
            }}
            style={{
              backgroundColor: canSend ? '#0077b6' : '#94a3b8',
              padding: 12,
              borderRadius: 12,
              marginTop: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>
              {isSending ? 'Sending...' : 'Send Message'}
            </Text>
          </Pressable>

          {sendMessageMutation.isSuccess && (
            <Text style={{ color: 'green', marginTop: 8 }}>
              Message sent successfully
            </Text>
          )}

          {sendMessageMutation.isError && (
            <Text style={{ color: 'red', marginTop: 8 }}>
              Failed to send message
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
