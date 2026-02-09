# Image Upload Optimization Guide

## 🎯 Current Implementation

The avatar upload now **automatically detects the correct file type** from the blob/URI and uses it:

### ✅ What's Fixed
- **Web**: Detects actual MIME type from blob (PNG, JPEG, GIF, etc.)
- **Native**: Maps file extension to proper MIME type
- **Timeout**: Increased to 30 seconds for large uploads
- **Better logging**: Shows detected types and sizes

## 📦 Optional: Add JPEG Conversion

If you want to **force all images to JPEG** (more compatible with BuddyPress and smaller files):

### Step 1: Install Package
```bash
npx expo install expo-image-manipulator
```

### Step 2: Update `settings.tsx`

Replace the `handlePickImage` function:

```tsx
import { convertToJPEG } from '../../lib/imageHelpers';

const handlePickImage = async (type: 'avatar' | 'cover') => {
  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      // Convert to JPEG before upload (optional but recommended)
      const jpegUri = await convertToJPEG(asset.uri, 0.8);
      
      if (type === 'avatar') {
        await handleUploadAvatar(jpegUri);
      } else {
        await handleUploadCover(jpegUri);
      }
    }
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert('Error', 'Failed to pick image. Please try again.');
  }
};
```

### Step 3: Even Better - Optimize Size

For avatars, you can also resize to save bandwidth:

```tsx
import { optimizeAvatarImage, optimizeCoverImage } from '../../lib/imageHelpers';

const handlePickImage = async (type: 'avatar' | 'cover') => {
  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      // Optimize based on type
      const optimizedUri = type === 'avatar' 
        ? await optimizeAvatarImage(asset.uri, 500, 0.8)  // Max 500x500px
        : await optimizeCoverImage(asset.uri, 1300, 0.8);  // Max 1300px wide
      
      if (type === 'avatar') {
        await handleUploadAvatar(optimizedUri);
      } else {
        await handleUploadCover(optimizedUri);
      }
    }
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert('Error', 'Failed to pick image. Please try again.');
  }
};
```

## 🔍 Benefits of JPEG Conversion

| Aspect | Without Conversion | With JPEG Conversion |
|--------|-------------------|---------------------|
| **File Size** | PNG can be 2-5MB | JPEG usually < 500KB |
| **Compatibility** | PNG/HEIC may fail | JPEG always works |
| **Upload Speed** | Slower | Faster |
| **Server Processing** | May fail with HEIC | Always succeeds |
| **BuddyPress** | Sometimes rejects PNG | Always works |

## 🐛 Backend Debugging

Add these logs to your PHP endpoint:

```php
function coral_upload_avatar($request) {
    error_log('🔵 coral_upload_avatar called');
    error_log('🔵 User ID: ' . $request->get_param('id'));
    error_log('🔵 $_FILES: ' . print_r($_FILES, true));
    error_log('🔵 Request file params: ' . print_r($request->get_file_params(), true));
    
    if (!empty($_FILES['file'])) {
        error_log('✅ File received - Name: ' . $_FILES['file']['name']);
        error_log('✅ File type: ' . $_FILES['file']['type']);
        error_log('✅ File size: ' . $_FILES['file']['size'] . ' bytes');
    } else {
        error_log('❌ No file in $_FILES');
    }
    
    // ... rest of your code
}
```

Check logs in `wp-content/debug.log` after enabling:
```php
// In wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

## 📊 Current Log Output

After the fix, you should see:

```
🔍 Platform detected: web
📷 Image URI received: blob:http://localhost:8081/...
🌐 Processing for Web platform
📦 Blob created - size: 245632 type: image/png
🎯 Detected MIME type: image/png - Extension: png
📄 File created - name: avatar.png type: image/png size: 245632
✅ FormData appended with file
🚀 Sending request to: https://www.thecoralreefresearchhub.com/wp-json/coral/v1/users/6489/avatar
📡 Response status: 200
✅ Upload successful - Avatar URLs: { full: "...", thumb: "..." }
```

## 🎯 Recommendation

**Without expo-image-manipulator**: Current code works, detects types correctly
**With expo-image-manipulator**: Best option - consistent JPEG, smaller files, better compatibility

Choose based on your needs:
- **Quick fix**: Current implementation (no extra package)
- **Production ready**: Add JPEG conversion (install package + update code)
