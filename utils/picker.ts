import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export type ActionType = 'photo' | 'file' | 'video' | 'audio' | 'link';

export type Attachment = {
  type: Exclude<ActionType, 'link'>;
  uri: string;
  name?: string;
  mime?: string;
};

// central place for all picking logic
export async function pickAttachment(type: ActionType): Promise<Attachment | null> {
  if (type === 'photo' || type === 'video') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access media library is required.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'photo'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    return {
      type,
      uri: asset.uri,
      name: asset.fileName ?? `${type}.${type === 'photo' ? 'jpg' : 'mp4'}`,
      mime: asset.mimeType ?? (type === 'photo' ? 'image/jpeg' : 'video/mp4'),
    };
  }

  if (type === 'file' || type === 'audio') {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: type === 'audio'
        ? ['audio/*']
        : ['*/*'],
    });

    if (res.canceled) return null;

    const file = res.assets[0];
    return {
      type: type === 'audio' ? 'audio' : 'file',
      uri: file.uri,
      name: file.name,
      mime: file.mimeType ?? 'application/octet-stream',
    };
  }

  return null;
}