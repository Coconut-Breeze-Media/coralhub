import React from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import FilterBar, { type ScopeFilter } from '../FilterBar';
import ComposerCard from './ComposerCard';
import { type Attachment } from './AttachmentsTray';
import { type PrivacyOption } from '../PrivacySelector';

export default function FeedHeader({
  scope, onChangeScope,
  composer, onChangeComposer,
  privacy, onChangePrivacy,
  attachments, onRemoveAttachment,
  onPick, onSubmit, onOpenLink,
  canSubmit,
}: {
  scope: ScopeFilter;
  onChangeScope: (s: ScopeFilter) => void;
  composer: string;
  onChangeComposer: (v: string) => void;
  privacy: PrivacyOption;
  onChangePrivacy: (v: PrivacyOption) => void;
  attachments: Attachment[];
  onRemoveAttachment: (uri: string) => void;
  onPick: (type: any) => Promise<void>;
  onSubmit: () => Promise<void> | void;
  onOpenLink: () => void;
  canSubmit: boolean;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: '#fff' }}
    >
      <FilterBar active={scope} onChange={onChangeScope} />
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <ComposerCard
          composer={composer}
          onChangeComposer={onChangeComposer}
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
          privacy={privacy}
          onChangePrivacy={onChangePrivacy}
          onPick={onPick}
          onSubmit={onSubmit}
          onOpenLink={onOpenLink}
          canSubmit={canSubmit}
        />
      </View>
    </KeyboardAvoidingView>
  );
}