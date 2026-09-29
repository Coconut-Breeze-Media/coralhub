// components/MentionInput.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useSearchUsers } from '../hooks/useActivity';
import type { UserSearchResult } from '../lib/api';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Detects an active @mention at the end of the string.
 * Returns the partial query (text after @) and its start index,
 * or null if no active mention is found.
 */
function getActiveMention(text: string): { query: string; startIndex: number } | null {
  // Match @ followed by word characters at the end of the string (no space after @)
  const match = text.match(/@(\w*)$/);
  if (!match) return null;
  const startIndex = text.lastIndexOf('@' + match[1]);
  return { query: match[1], startIndex };
}

/**
 * Replaces the active @partial in text with @mention_name + trailing space.
 */
function insertMention(text: string, startIndex: number, mentionName: string): string {
  return text.slice(0, startIndex) + '@' + mentionName + ' ';
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  token: string | null;
  placeholder?: string;
  placeholderTextColor?: string;
  multiline?: boolean;
  maxLength?: number;
  maxHeight?: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Where to render the suggestion list. Default: 'above' */
  suggestionPosition?: 'above' | 'below';
}

// ─────────────────────────────────────────────
// Suggestion row
// ─────────────────────────────────────────────

function SuggestionRow({
  user,
  onSelect,
}: {
  user: UserSearchResult;
  onSelect: (user: UserSearchResult) => void;
}) {
  const avatarUrl = user.avatar_urls?.thumb || user.avatar_urls?.full;
  return (
    <TouchableOpacity style={styles.suggestionRow} onPress={() => onSelect(user)}>
      <View style={styles.suggestionAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.suggestionAvatarImage} />
        ) : (
          <Text style={styles.suggestionAvatarText}>
            {user.name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        )}
      </View>
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={styles.suggestionHandle} numberOfLines={1}>
          @{user.mention_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function MentionInput({
  value,
  onChangeText,
  token,
  placeholder,
  placeholderTextColor,
  multiline,
  maxLength,
  maxHeight,
  style,
  containerStyle,
  suggestionPosition = 'above',
}: MentionInputProps) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: suggestions = [], isFetching } = useSearchUsers(token, mentionQuery);

  const handleChangeText = (text: string) => {
    onChangeText(text);

    // Detect active mention
    const active = getActiveMention(text);

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (active) {
      // Debounce 300ms before triggering search
      debounceRef.current = setTimeout(() => {
        setMentionQuery(active.query || null);
      }, 300);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    const active = getActiveMention(value);
    if (!active) return;
    const newText = insertMention(value, active.startIndex, user.mention_name);
    onChangeText(newText);
    setMentionQuery(null);
  };

  const showSuggestions = !!mentionQuery && (suggestions.length > 0 || isFetching);

  const SuggestionList = () => (
    <View style={styles.suggestionsContainer}>
      {isFetching && suggestions.length === 0 ? (
        <ActivityIndicator
          size="small"
          color="#0e7490"
          style={styles.suggestionsLoader}
        />
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <SuggestionRow user={item} onSelect={handleSelectUser} />
          )}
          keyboardShouldPersistTaps="always"
          scrollEnabled={suggestions.length > 4}
          style={{ maxHeight: 180 }}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {suggestionPosition === 'above' && showSuggestions && <SuggestionList />}

      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        maxLength={maxLength}
        {...(maxHeight ? { maxHeight } : {})}
      />

      {suggestionPosition === 'below' && showSuggestions && <SuggestionList />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  input: {
    flex: 1,
  },
  // Suggestions dropdown
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  suggestionsLoader: {
    paddingVertical: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0e7490',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  suggestionAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  suggestionAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  suggestionHandle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
});
