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
    console.log('🔄 Converting image to JPEG:', imageUri);
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // No transformations, just format conversion
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    console.log('✅ Image converted to JPEG:', result.uri);
    console.log('📏 Dimensions:', result.width, 'x', result.height);
    
    return result.uri;
  } catch (error) {
    console.error('❌ Error converting image to JPEG:', error);
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
    console.log('🎨 Optimizing avatar image:', imageUri);
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxSize, height: maxSize } }],
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    console.log('✅ Avatar optimized:', result.uri);
    console.log('📏 Final size:', result.width, 'x', result.height);
    
    return result.uri;
  } catch (error) {
    console.error('❌ Error optimizing avatar:', error);
    return imageUri;
  }
}

/**
 * Resize and convert image for cover upload
 * Optimizes for typical cover dimensions (16:9)
 * 
 * @param imageUri - Original image URI
 * @param maxWidth - Maximum width, default 1300px
 * @param quality - Compression quality (0-1), default 0.8
 * @returns URI of optimized image
 */
export async function optimizeCoverImage(
  imageUri: string,
  maxWidth: number = 1300,
  quality: number = 0.8
): Promise<string> {
  try {
    console.log('🎨 Optimizing cover image:', imageUri);
    
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxWidth } }], // Height calculated automatically to maintain aspect
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    console.log('✅ Cover optimized:', result.uri);
    console.log('📏 Final size:', result.width, 'x', result.height);
    
    return result.uri;
  } catch (error) {
    console.error('❌ Error optimizing cover:', error);
    return imageUri;
  }
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
    console.error('Error getting image info:', error);
    return {};
  }
}
