export type SelectedImageAttachment = {
  uri: string;
  fileName: string;
  fileSize: number | null;
};

type PickedImageAsset = {
  uri: string;
  fileName?: string | null;
  fileSize?: number;
};

/**
 * Build the image metadata shown by post composers.
 * Some native pickers omit the size, so read it from the selected URI as a fallback.
 */
export async function createImageAttachment(
  asset: PickedImageAsset,
  fallbackIndex: number
): Promise<SelectedImageAttachment> {
  let fileSize = asset.fileSize ?? null;

  if (fileSize === null) {
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      fileSize = blob.size;
    } catch {
      // The preview remains usable even when a native content provider does
      // not expose file metadata or allow the URI to be read directly.
    }
  }

  const uriFileName = asset.uri
    .split(/[?#]/)[0]
    .split('/')
    .pop();

  let decodedUriFileName = uriFileName || null;
  if (uriFileName) {
    try {
      decodedUriFileName = decodeURIComponent(uriFileName);
    } catch {
      // Keep the original URI segment if it contains invalid escape characters.
    }
  }

  return {
    uri: asset.uri,
    fileName: asset.fileName || decodedUriFileName || `image-${fallbackIndex + 1}.jpg`,
    fileSize,
  };
}

/** Format bytes as a compact, readable file size. */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) {
    return 'Size unavailable';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}
