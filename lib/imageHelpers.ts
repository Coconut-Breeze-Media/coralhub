// lib/imageHelpers.ts
/**
 * Image helper utilities for avatar/cover uploads
 * Provides image conversion and optimization functions
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Convert any image to JPEG format with compression
 * Ensures maximum compatibility with backend
 * 
 * @param imageUri - Original image URI
 * @param quality - Compression quality (0-1), default 0.8
 * @returns URI of converted JPEG image
 */
export async function convertToJPEG(
  imageUri: string,
  quality: number = 0.8
): Promise<string> {
  try {
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // No transformations, just format conversion
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    return result.uri;
  } catch (error) {
    // If conversion fails, return original URI
    return imageUri;
  }
}

/**
 * Resize and convert image for avatar upload
 * Optimizes image size and format
 * 
 * @param imageUri - Original image URI
 * @param maxSize - Maximum dimension (width/height), default 500px
 * @param quality - Compression quality (0-1), default 0.8
 * @returns URI of optimized image
 */
export async function optimizeAvatarImage(
  imageUri: string,
  maxSize: number = 500,
  quality: number = 0.8
): Promise<string> {
  try {
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxSize, height: maxSize } }],
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    return result.uri;
  } catch (error) {
    return imageUri;
  }
}

/**
 * Resize and convert image for cover upload
 * Resizes the selected 27:7 crop for the BuddyPress cover-image minimum.
 * 
 * @param imageUri - Original image URI
 * @param targetWidth - Output width, default 1400px
 * @param quality - Compression quality (0-1), default 0.8
 * @returns URI of optimized image
 */
export async function optimizeCoverImage(
  imageUri: string,
  targetWidth: number = 1400,
  quality: number = 0.8
): Promise<string> {
  try {
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: targetWidth } }], // Height is calculated automatically to maintain aspect.
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    return result.uri;
  } catch (error) {
    return imageUri;
  }
}

const POST_IMAGE_MAX_BYTES = 900_000;

async function byteSize(uri: string): Promise<number | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return typeof blob.size === 'number' ? blob.size : null;
  } catch {
    return null;
  }
}

/**
 * Resize a photo before it is attached to a post.
 * Phone pictures are often many megabytes, and the website rejects oversized
 * uploads. Step the dimensions and quality down until the file is under the
 * limit the site will accept.
 */
export async function preparePostImage(imageUri: string): Promise<string> {
  let width = 1600;
  let quality = 0.72;
  let current = imageUri;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );
      current = result.uri;
      const size = await byteSize(current);
      if (size == null || size <= POST_IMAGE_MAX_BYTES) return current;
    } catch {
      return current;
    }
    quality = Math.max(0.45, quality - 0.1);
    width = Math.round(width * 0.75);
  }

  return current;
}

/**
 * Get file info from URI (web only)
 */
export async function getImageInfo(imageUri: string): Promise<{
  size?: number;
  type?: string;
}> {
  if (Platform.OS !== 'web') {
    return {};
  }
  
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    return {
      size: blob.size,
      type: blob.type,
    };
  } catch (error) {
    return {};
  }
}
