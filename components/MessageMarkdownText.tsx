import type { ReactNode } from 'react';
import {
  Linking,
  Text,
  View,
} from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

const INLINE_PATTERN =
  /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|_([^_]+)_/g;

function renderInlineContent(
  value: string,
  textStyle: StyleProp<TextStyle>,
  linkStyle: StyleProp<TextStyle>
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of value.matchAll(INLINE_PATTERN)) {
    const startIndex = match.index ?? 0;

    if (startIndex > cursor) {
      nodes.push(
        <Text key={`plain-${key++}`} style={textStyle}>
          {value.slice(cursor, startIndex)}
        </Text>
      );
    }

    if (match[1] && match[2]) {
      const label = match[1];
      const url = match[2];

      nodes.push(
        <Text
          key={`link-${key++}`}
          accessibilityRole="link"
          style={linkStyle}
          onPress={() => {
            void Linking.openURL(url);
          }}
        >
          {label}
        </Text>
      );
    } else if (match[3]) {
      nodes.push(
        <Text
          key={`bold-${key++}`}
          style={[textStyle, { fontWeight: '700' }]}
        >
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      nodes.push(
        <Text
          key={`italic-${key++}`}
          style={[textStyle, { fontStyle: 'italic' }]}
        >
          {match[4]}
        </Text>
      );
    }

    cursor = startIndex + match[0].length;
  }

  if (cursor < value.length) {
    nodes.push(
      <Text key={`plain-${key++}`} style={textStyle}>
        {value.slice(cursor)}
      </Text>
    );
  }

  if (nodes.length === 0) {
    nodes.push(
      <Text key="plain-empty" style={textStyle}>
        {value}
      </Text>
    );
  }

  return nodes;
}

export function MessageMarkdownText({
  value,
  textStyle,
  linkColor,
}: {
  value: string;
  textStyle: StyleProp<TextStyle>;
  linkColor?: string;
}) {
  const lines = value.split('\n');
  const resolvedLinkStyle: StyleProp<TextStyle> = [
    textStyle,
    {
      color: linkColor ?? '#0369a1',
      textDecorationLine: 'underline',
      fontWeight: '600',
    },
  ];

  return (
    <View>
      {lines.map((line, index) => {
        const bulletMatch = line.match(/^[-*]\s+(.*)$/);
        const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        const isLastLine = index === lines.length - 1;

        if (!line.trim()) {
          return (
            <View
              key={`spacer-${index}`}
              style={{ height: isLastLine ? 0 : 8 }}
            />
          );
        }

        if (bulletMatch) {
          return (
            <View
              key={`bullet-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: isLastLine ? 0 : 6,
              }}
            >
              <Text style={[textStyle, { marginRight: 6 }]}>•</Text>
              <Text style={[textStyle, { flexShrink: 1 }]}>
                {renderInlineContent(bulletMatch[1], textStyle, resolvedLinkStyle)}
              </Text>
            </View>
          );
        }

        if (orderedMatch) {
          return (
            <View
              key={`ordered-${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: isLastLine ? 0 : 6,
              }}
            >
              <Text style={[textStyle, { marginRight: 6 }]}>
                {orderedMatch[1]}.
              </Text>
              <Text style={[textStyle, { flexShrink: 1 }]}>
                {renderInlineContent(orderedMatch[2], textStyle, resolvedLinkStyle)}
              </Text>
            </View>
          );
        }

        return (
          <Text
            key={`paragraph-${index}`}
            style={[textStyle, { marginBottom: isLastLine ? 0 : 6 }]}
          >
            {renderInlineContent(line, textStyle, resolvedLinkStyle)}
          </Text>
        );
      })}
    </View>
  );
}
