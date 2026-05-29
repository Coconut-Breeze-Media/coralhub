import { Pressable, ScrollView, Text, View } from 'react-native';

export type ComposerSelection = {
  start: number;
  end: number;
};

export type ComposerFormatAction =
  | 'bold'
  | 'italic'
  | 'bulletList'
  | 'orderedList'
  | 'link';

type ComposerFormatResult = {
  text: string;
  selection: ComposerSelection;
};

const ACTIONS: Array<{
  id: ComposerFormatAction;
  label: string;
}> = [
  { id: 'bold', label: 'Bold' },
  { id: 'italic', label: 'Italic' },
  { id: 'bulletList', label: 'Bullet List' },
  { id: 'orderedList', label: 'Numbered List' },
  { id: 'link', label: 'Link' },
];

function clampSelection(
  value: string,
  selection: ComposerSelection
): ComposerSelection {
  const textLength = value.length;
  const start = Math.max(0, Math.min(selection.start, textLength));
  const end = Math.max(start, Math.min(selection.end, textLength));

  return { start, end };
}

function replaceSelection(
  value: string,
  selection: ComposerSelection,
  nextContent: string,
  highlightStart: number,
  highlightEnd: number
): ComposerFormatResult {
  const nextText =
    value.slice(0, selection.start) +
    nextContent +
    value.slice(selection.end);

  return {
    text: nextText,
    selection: {
      start: selection.start + highlightStart,
      end: selection.start + highlightEnd,
    },
  };
}

function wrapSelection(
  value: string,
  selection: ComposerSelection,
  before: string,
  after: string,
  placeholder: string
): ComposerFormatResult {
  const selectedText = value.slice(selection.start, selection.end);
  const content = selectedText || placeholder;
  const nextContent = `${before}${content}${after}`;

  return replaceSelection(
    value,
    selection,
    nextContent,
    before.length,
    before.length + content.length
  );
}

function insertLink(
  value: string,
  selection: ComposerSelection
): ComposerFormatResult {
  const selectedText = value.slice(selection.start, selection.end);
  const label = selectedText || 'link text';
  const url = 'https://example.com';
  const nextContent = `[${label}](${url})`;

  if (selectedText) {
    const urlStart = label.length + 3;
    return replaceSelection(
      value,
      selection,
      nextContent,
      urlStart,
      urlStart + url.length
    );
  }

  return replaceSelection(value, selection, nextContent, 1, 1 + label.length);
}

function stripExistingListMarker(line: string): string {
  return line.replace(/^(\s*)([-*]\s+|\d+\.\s+)/, '$1');
}

function applyListFormat(
  value: string,
  selection: ComposerSelection,
  ordered: boolean
): ComposerFormatResult {
  const lineStart = value.lastIndexOf('\n', Math.max(selection.start - 1, 0)) + 1;
  const lineEndIndex = value.indexOf('\n', selection.end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const target = value.slice(lineStart, lineEnd);
  const originalLines = target ? target.split('\n') : [''];
  const nextLines = originalLines.map((line, index) => {
    const normalized = stripExistingListMarker(line).trim() || 'List item';
    return ordered ? `${index + 1}. ${normalized}` : `- ${normalized}`;
  });
  const nextContent = nextLines.join('\n');

  return {
    text: value.slice(0, lineStart) + nextContent + value.slice(lineEnd),
    selection: {
      start: lineStart,
      end: lineStart + nextContent.length,
    },
  };
}

export function applyComposerFormat(
  value: string,
  rawSelection: ComposerSelection,
  action: ComposerFormatAction
): ComposerFormatResult {
  const selection = clampSelection(value, rawSelection);

  switch (action) {
    case 'bold':
      return wrapSelection(value, selection, '**', '**', 'bold text');
    case 'italic':
      return wrapSelection(value, selection, '_', '_', 'italic text');
    case 'bulletList':
      return applyListFormat(value, selection, false);
    case 'orderedList':
      return applyListFormat(value, selection, true);
    case 'link':
      return insertLink(value, selection);
    default:
      return { text: value, selection };
  }
}

export function MessageFormattingToolbar({
  disabled = false,
  onActionPress,
}: {
  disabled?: boolean;
  onActionPress: (action: ComposerFormatAction) => void;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {ACTIONS.map((action, index) => (
          <Pressable
            key={action.id}
            disabled={disabled}
            onPress={() => onActionPress(action.id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#cbd5e1',
              backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
              marginRight: index === ACTIONS.length - 1 ? 0 : 8,
            }}
          >
            <Text
              style={{
                color: disabled ? '#94a3b8' : '#0f172a',
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {action.label}
            </Text>
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
        Formatting supports markdown-style bold, italic, lists, and links.
      </Text>
    </View>
  );
}
