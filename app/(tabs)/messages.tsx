import { Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useConversations } from '../../hooks/useMessages';

export default function MessagesScreen() {
  const { token } = useAuth();
  const { data, isLoading, error } = useConversations(token);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      {isLoading && <Text>Loading conversations...</Text>}

      {error && <Text>Error loading conversations</Text>}

      {Array.isArray(data) && data.length === 0 && (
        <Text>No conversations yet</Text>
        )}

      {data && (
        <FlatList
          data={Array.isArray(data) ? data : []}
          keyExtractor={(item: any, index) =>
            (item.id || item.thread_id || index).toString()
          }
          renderItem={({ item }: any) => (
            <Pressable
              onPress={() => console.log(item)}
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
              }}
            >
              <Text>{JSON.stringify(item)}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}