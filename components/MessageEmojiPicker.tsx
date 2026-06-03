import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

const DEFAULT_MESSAGE_EMOJIS = [
  '\u{1F60A}',
  '\u{1F602}',
  '\u{2764}\u{FE0F}',
  '\u{1F44D}',
  '\u{1F389}',
  '\u{1F525}',
  '\u{1F44F}',
  '\u{1F64C}',
];

export function MessageEmojiPicker({
  disabled = false,
  onEmojiPress,
}: {
  disabled?: boolean;
  onEmojiPress: (emoji: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={{ marginTop: 12 }}>
      <Pressable
        disabled={disabled}
        onPress={() => {
          setIsOpen((current) => !current);
        }}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: '#cbd5e1',
          backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
        }}
      >
        <Text
          style={{
            color: disabled ? '#94a3b8' : '#0f172a',
            fontSize: 12,
            fontWeight: '700',
          }}
        >
          {isOpen ? 'Hide Emojis' : 'Add Emoji'}
        </Text>
      </Pressable>

      {isOpen && (
        <View
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {DEFAULT_MESSAGE_EMOJIS.map((emoji, index) => (
              <Pressable
                key={`${emoji}-${index}`}
                disabled={disabled}
                onPress={() => onEmojiPress(emoji)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  marginRight: index === DEFAULT_MESSAGE_EMOJIS.length - 1 ? 0 : 4,
                }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text
            style={{
              marginTop: 8,
              color: '#64748b',
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            Tap an emoji to insert it where your cursor is.
          </Text>
        </View>
      )}
    </View>
  );
}
