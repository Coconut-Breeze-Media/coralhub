# Profile Settings Module - Setup Guide

## Overview
The Profile Settings module allows users to view and edit their BuddyPress profile information, including display name, avatar (profile picture), and cover image.

## Installation

### 1. Install Required Dependencies

```bash
npx expo install expo-image-picker
```

This package is required for selecting images from the device's photo library.

## Files Created

### 1. Types (`types/index.ts`)
Added BuddyPress-related type definitions:
- `BPMember`: BuddyPress member profile data
- `UpdateMemberPayload`: Payload for updating member profile
- `BPAvatar`: Avatar URLs (full and thumb)
- `BPCoverImage`: Cover image data
- `XProfileFieldData`: Extended profile field data
- `UpdateXProfilePayload`: Payload for updating XProfile fields

### 2. API Functions (`lib/api.ts`)
Added BuddyPress API functions:
- `getCurrentMember()`: Get current user's profile
- `getMemberById()`: Get member by ID
- `updateCurrentMember()`: Update profile display name
- `getUserAvatar()`: Get avatar URLs
- `uploadUserAvatar()`: Upload new avatar
- `deleteUserAvatar()`: Delete avatar
- `getUserCover()`: Get cover image
- `uploadUserCover()`: Upload cover image
- `deleteUserCover()`: Delete cover image
- `updateXProfileField()`: Update extended profile fields

### 3. Hooks (`hooks/useProfile.ts`)
Custom React Query hooks for profile management:
- `useCurrentMember()`: Fetch current user's profile
- `useMember(userId)`: Fetch member by ID
- `useUserAvatar(userId)`: Fetch user avatar
- `useUserCover(userId)`: Fetch user cover image
- `useUpdateProfile()`: Mutation for updating profile
- `useUploadAvatar()`: Mutation for uploading avatar
- `useDeleteAvatar()`: Mutation for deleting avatar
- `useUploadCover()`: Mutation for uploading cover
- `useDeleteCover()`: Mutation for deleting cover
- `useUpdateXProfileField()`: Mutation for updating XProfile fields

### 4. Screen Component (`app/profile/settings.tsx`)
Complete profile settings screen with:
- Display name editing
- Avatar upload/change/delete
- Cover image upload/change/delete
- Read-only account information display
- Loading and error states
- Permission handling for image picker

### 5. Navigation (`constants/navigation.ts`)
Updated profile menu to include settings route

## API Endpoints Used

### BuddyPress Member API
- `GET /buddypress/v1/members/me` - Get current user profile
- `GET /buddypress/v1/members/{id}` - Get member by ID
- `POST /buddypress/v1/members/me` - Update current user profile

### Avatar API
- `GET /buddypress/v1/members/{id}/avatar` - Get avatar URLs
- `POST /buddypress/v1/members/{id}/avatar` - Upload avatar
- `DELETE /buddypress/v1/members/{id}/avatar` - Delete avatar

### Cover Image API
- `GET /buddypress/v1/members/{id}/cover` - Get cover image
- `POST /buddypress/v1/members/{id}/cover` - Upload cover image
- `DELETE /buddypress/v1/members/{id}/cover` - Delete cover image

### XProfile API
- `POST /buddypress/v1/xprofile/{field_id}/data/{user_id}` - Update profile field

## Features

### 1. Display Name Management
- View current display name
- Edit display name inline
- Save/cancel functionality
- Validation (non-empty)

### 2. Profile Picture (Avatar)
- View current avatar
- Upload new avatar from photo library
- Delete existing avatar
- Square aspect ratio (1:1)
- Loading indicators during upload/delete
- Confirmation before deletion

### 3. Cover Image
- View current cover image
- Upload new cover image
- Delete existing cover
- Wide aspect ratio (16:9)
- Loading indicators
- Confirmation before deletion

### 4. Account Information (Read-only)
- Username/mention name
- Member ID
- Registration date

## User Experience

### Permissions
- Automatically requests photo library permissions on first image selection
- Shows alert if permissions are denied
- Permissions not required on web platform

### Error Handling
- Network errors show user-friendly alerts
- Loading states prevent multiple submissions
- Validation prevents empty display names
- Failed operations show specific error messages

### Success Feedback
- Success alerts after profile updates
- Automatic query invalidation refreshes data
- Optimistic UI updates where appropriate

## Technical Details

### Image Upload
- Uses FormData for multipart/form-data uploads
- Supports common image formats (JPEG, PNG, etc.)
- Image quality set to 0.8 for balance between quality and file size
- Aspect ratio enforced via ImagePicker options

### State Management
- React Query for server state
- Local state for form editing
- Automatic cache invalidation on mutations
- 5-10 minute stale times for profile data

### Platform Support
- iOS: Full support with native image picker
- Android: Full support with native image picker
- Web: Uses web file picker

## Future Enhancements

Potential additions (not implemented yet):
1. XProfile extended fields editing (bio, location, etc.)
2. Email change functionality
3. Password change
4. Cropping tool for images
5. Multiple image upload at once
6. Progress indicators for large file uploads
7. Image compression before upload
8. Profile preview before saving

## Usage Example

```typescript
import { Link } from 'expo-router';

// Navigate to profile settings
<Link href="/profile/settings">
  <Text>Edit Profile</Text>
</Link>
```

## Notes

- Username (user_login) is read-only and cannot be changed (WordPress/BuddyPress security)
- Email and password changes require separate WordPress endpoints
- XProfile fields can be extended but require field IDs from backend
- Image uploads work differently on web vs native platforms
