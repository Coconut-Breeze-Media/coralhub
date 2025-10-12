import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Card from '../ui/Card';
import ComposerActions, { type ActionType } from '../ComposerActions';
import AttachmentsTray, { type Attachment } from './AttachmentsTray';
import PrivacySelector, { type PrivacyOption } from '../PrivacySelector';

const PRIMARY = '#0077b6';

export default function ComposerCard({
  composer, onChangeComposer,
  attachments, onRemoveAttachment,
  privacy, onChangePrivacy,
  onPick, onSubmit, onOpenLink,
  canSubmit,
}: {
  composer: string;
  onChangeComposer: (v: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (uri: string) => void;
  privacy: PrivacyOption;
  onChangePrivacy: (v: PrivacyOption) => void;
  onPick: (type: ActionType) => Promise<void>;
  onSubmit: () => Promise<void> | void;
  onOpenLink: () => void;
  canSubmit: boolean;
}) {
  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>What’s new?</Text>

      <TextInput
        value={composer}
        onChangeText={onChangeComposer}
        placeholder="Share an update…"
        multiline
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, minHeight: 60 }}
      />

      <ComposerActions
        onPick={(type) => type === 'link' ? onOpenLink() : onPick(type)}
        onQuick={() => {}}
        counts={{
          photo: attachments.filter(a => a.type === 'photo').length,
          video: attachments.filter(a => a.type === 'video').length,
          file:  attachments.filter(a => a.type === 'file').length,
          audio: attachments.filter(a => a.type === 'audio').length,
        }}
      />

      <AttachmentsTray items={attachments} onRemove={onRemoveAttachment} />

      <PrivacySelector value={privacy} onChange={onChangePrivacy} />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit}
          style={{
            backgroundColor: canSubmit ? PRIMARY : '#93c5fd',
            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
            opacity: canSubmit ? 1 : 0.8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}