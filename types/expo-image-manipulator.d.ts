declare module 'expo-image-manipulator' {
  export const SaveFormat: {
    JPEG: 'jpeg';
    PNG: 'png';
    WEBP: 'webp';
  };

  export function manipulateAsync(
    uri: string,
    actions: Array<{
      resize?: {
        width?: number;
        height?: number;
      };
    }>,
    options?: {
      compress?: number;
      format?: string;
    }
  ): Promise<{
    uri: string;
    width: number;
    height: number;
  }>;
}
