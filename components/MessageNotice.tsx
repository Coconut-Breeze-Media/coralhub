import { Pressable, Text, View } from 'react-native';

type NoticeTone = 'success' | 'error';

const TONE_STYLES: Record<
  NoticeTone,
  {
    borderColor: string;
    backgroundColor: string;
    titleColor: string;
    bodyColor: string;
    dismissColor: string;
  }
> = {
  success: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    titleColor: '#075985',
    bodyColor: '#0369a1',
    dismissColor: '#0369a1',
  },
  error: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    titleColor: '#991b1b',
    bodyColor: '#b91c1c',
    dismissColor: '#b91c1c',
  },
};

export function MessageNotice({
  tone,
  title,
  description,
  onDismiss,
}: {
  tone: NoticeTone;
  title: string;
  description?: string;
  onDismiss?: () => void;
}) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: toneStyle.borderColor,
        backgroundColor: toneStyle.backgroundColor,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <View style={{ flex: 1, paddingRight: onDismiss ? 12 : 0 }}>
        <Text
          style={{
            color: toneStyle.titleColor,
            fontWeight: '700',
            fontSize: 14,
            marginBottom: description ? 4 : 0,
          }}
        >
          {title}
        </Text>

        {!!description && (
          <Text
            style={{
              color: toneStyle.bodyColor,
              lineHeight: 19,
            }}
          >
            {description}
          </Text>
        )}
      </View>

      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          style={{ paddingVertical: 2 }}
        >
          <Text
            style={{
              color: toneStyle.dismissColor,
              fontWeight: '700',
            }}
          >
            Dismiss
          </Text>
        </Pressable>
      )}
    </View>
  );
}
