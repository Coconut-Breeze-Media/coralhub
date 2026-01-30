# Push Notifications Documentation

## Overview

This guide covers the complete implementation of push notifications in CoralHub using Expo Notifications. The system allows you to send push notifications to users on iOS and Android devices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup Instructions](#setup-instructions)
3. [Architecture](#architecture)
4. [API Reference](#api-reference)
5. [Testing](#testing)
6. [Backend Integration](#backend-integration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Physical Device**: Push notifications only work on physical iOS/Android devices, not on simulators/emulators
- **Expo Account**: Sign up at [expo.dev](https://expo.dev)
- **EAS CLI**: Install globally with `npm install -g eas-cli`
- **Expo Go App** (for development testing) or build a development client

---

## Setup Instructions

### Step 1: Initialize EAS Project

Run the following commands in your project directory:

```bash
# Login to your Expo account
eas login
# Use: cristian@coconutbreezemedia.com

# Initialize EAS in your project
eas init
```

This will create an EAS project and add the `projectId` to your app configuration.

### Step 2: Update app.config.js

After running `eas init`, your `projectId` will be automatically added. Verify it's present in `app.config.js`:

```javascript
extra: {
  eas: {
    projectId: "your-actual-project-id-here"
  }
}
```

### Step 3: Install Dependencies

Dependencies are already installed via:

```bash
npx expo install expo-notifications expo-device expo-constants
```

### Step 4: Configure iOS (if targeting iOS)

For iOS, you need to configure push notification credentials:

```bash
# This will guide you through setting up APNs credentials
eas credentials
```

### Step 5: Test on Device

#### Option A: Using Expo Go (Development)

1. Install Expo Go on your device
2. Run: `npx expo start`
3. Scan QR code with your device
4. Grant notification permissions when prompted

#### Option B: Using Development Build (Recommended)

```bash
# Build development client for iOS
eas build --profile development --platform ios

# Build development client for Android
eas build --profile development --platform android
```

---

## Architecture

### File Structure

```
coralhub/
├── lib/
│   └── notifications.ts        # Core notification service functions
├── hooks/
│   └── useNotifications.ts     # React hook for notifications
├── App.tsx                      # Root component with notification initialization
└── app.config.js               # Expo configuration with notification settings
```

### Components

#### 1. Notification Service (`lib/notifications.ts`)

Core functions for managing push notifications:

- `registerForPushNotificationsAsync()` - Registers device and gets Expo Push Token
- `scheduleTestNotification()` - Schedules local notifications for testing
- `cancelNotification()` - Cancels a specific scheduled notification
- `cancelAllNotifications()` - Cancels all scheduled notifications
- `getBadgeCount()` / `setBadgeCount()` - Manages app badge count
- `clearBadgeCount()` - Clears the badge count

#### 2. Notification Hook (`hooks/useNotifications.ts`)

React hook that provides:

- `expoPushToken` - The device's Expo Push Token
- `notification` - Latest notification received or interacted with

#### 3. API Integration (`lib/api.ts`)

Backend communication functions:

- `registerPushToken()` - Saves push token to backend
- `removePushToken()` - Removes push token from backend

---

## API Reference

### `registerForPushNotificationsAsync()`

Requests notification permissions and retrieves the Expo Push Token.

**Returns:** `Promise<string | undefined>`

**Example:**
```typescript
import { registerForPushNotificationsAsync } from './lib/notifications';

const token = await registerForPushNotificationsAsync();
console.log('Push Token:', token);
```

---

### `useNotifications()`

React hook for handling notifications in components.

**Returns:** 
```typescript
{
  expoPushToken: string | undefined;
  notification: {
    notification: Notifications.Notification;
    response?: Notifications.NotificationResponse;
  } | undefined;
}
```

**Example:**
```typescript
import { useNotifications } from './hooks/useNotifications';

function MyComponent() {
  const { expoPushToken, notification } = useNotifications();
  
  useEffect(() => {
    if (expoPushToken) {
      // Send token to your backend
      sendTokenToServer(expoPushToken);
    }
  }, [expoPushToken]);

  useEffect(() => {
    if (notification?.response) {
      // User tapped on notification
      const data = notification.notification.request.content.data;
      // Navigate to specific screen based on data
    }
  }, [notification]);
}
```

---

### `scheduleTestNotification(title, body, seconds)`

Schedules a local notification for testing purposes.

**Parameters:**
- `title` (string) - Notification title
- `body` (string) - Notification body text
- `seconds` (number) - Delay in seconds before showing (default: 2)

**Returns:** `Promise<string>` - Notification ID

**Example:**
```typescript
import { scheduleTestNotification } from './lib/notifications';

// Schedule a notification to appear in 5 seconds
const notificationId = await scheduleTestNotification(
  'Test Notification',
  'This is a test message',
  5
);
```

---

### `setBadgeCount(count)` / `clearBadgeCount()`

Manages the app icon badge count.

**Example:**
```typescript
import { setBadgeCount, clearBadgeCount } from './lib/notifications';

// Set badge to 5
await setBadgeCount(5);

// Clear badge
await clearBadgeCount();
```

---

### Backend API Functions

#### `registerPushToken(token, pushToken, deviceId)`

Registers a push token with your backend server.

**Parameters:**
- `token` (string) - JWT authentication token
- `pushToken` (string) - Expo push token
- `deviceId` (string) - Unique device identifier

**Example:**
```typescript
import { registerPushToken } from './lib/api';
import * as Device from 'expo-device';

const deviceId = Device.osBuildId || Device.osInternalBuildId || 'unknown';
await registerPushToken(authToken, expoPushToken, deviceId);
```

---

## Testing

### Test Local Notifications

Create a test component or screen:

```typescript
import { View, Button, Text } from 'react-native';
import { scheduleTestNotification } from '../lib/notifications';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationTest() {
  const { expoPushToken, notification } = useNotifications();

  const handleTestNotification = async () => {
    await scheduleTestNotification(
      'Test Notification',
      'This notification will appear in 2 seconds',
      2
    );
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Push Token: {expoPushToken || 'Loading...'}</Text>
      
      <Button 
        title="Send Test Notification" 
        onPress={handleTestNotification}
      />
      
      {notification && (
        <Text>
          Last Notification: {notification.notification.request.content.title}
        </Text>
      )}
    </View>
  );
}
```

### Test Push Notifications from Server

Use the Expo Push Notification Tool:

1. Go to: https://expo.dev/notifications
2. Enter your Expo Push Token
3. Enter title and message
4. Click "Send a Notification"

### Test with cURL

```bash
curl -H "Content-Type: application/json" \
  -X POST https://exp.host/--/api/v2/push/send \
  -d '{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Test Notification",
  "body": "This is a test from cURL",
  "data": { "screen": "profile" }
}'
```

---

## Backend Integration

### Required Backend Endpoint

Your WordPress backend needs to implement the following endpoint:

**Endpoint:** `POST /wp-json/coral/v1/push-token`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "device_id": "unique-device-identifier",
  "platform": "expo"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Push token registered successfully"
}
```

### Backend Implementation Example (PHP/WordPress)

```php
// In your WordPress plugin
add_action('rest_api_init', function () {
  register_rest_route('coral/v1', '/push-token', [
    'methods' => 'POST',
    'callback' => 'handle_push_token_registration',
    'permission_callback' => function() {
      return is_user_logged_in();
    }
  ]);
});

function handle_push_token_registration($request) {
  $user_id = get_current_user_id();
  $push_token = $request->get_param('push_token');
  $device_id = $request->get_param('device_id');
  $platform = $request->get_param('platform');

  // Store in database
  global $wpdb;
  $table_name = $wpdb->prefix . 'push_tokens';
  
  $wpdb->replace(
    $table_name,
    [
      'user_id' => $user_id,
      'device_id' => $device_id,
      'push_token' => $push_token,
      'platform' => $platform,
      'updated_at' => current_time('mysql')
    ]
  );

  return [
    'success' => true,
    'message' => 'Push token registered successfully'
  ];
}
```

### Database Schema

```sql
CREATE TABLE wp_push_tokens (
  id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT(20) UNSIGNED NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  push_token VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY device_id (device_id),
  KEY user_id (user_id)
);
```

### Sending Push Notifications from Backend

```php
function send_push_notification($user_id, $title, $body, $data = []) {
  global $wpdb;
  $table_name = $wpdb->prefix . 'push_tokens';
  
  // Get all tokens for this user
  $tokens = $wpdb->get_results($wpdb->prepare(
    "SELECT push_token FROM $table_name WHERE user_id = %d",
    $user_id
  ));

  if (empty($tokens)) {
    return false;
  }

  $messages = [];
  foreach ($tokens as $token_row) {
    $messages[] = [
      'to' => $token_row->push_token,
      'sound' => 'default',
      'title' => $title,
      'body' => $body,
      'data' => $data,
    ];
  }

  // Send to Expo Push API
  $response = wp_remote_post('https://exp.host/--/api/v2/push/send', [
    'headers' => [
      'Content-Type' => 'application/json',
      'Accept' => 'application/json',
    ],
    'body' => json_encode($messages),
  ]);

  return !is_wp_error($response);
}

// Example usage:
send_push_notification(
  $user_id, 
  'New Message', 
  'You have a new message from John',
  ['screen' => 'messages', 'message_id' => 123]
);
```

---

## Troubleshooting

### Common Issues

#### 1. "Push notifications only work on physical devices"

**Solution:** Push notifications don't work on iOS Simulator or Android Emulator. Test on a real device.

---

#### 2. "EAS Project ID not found"

**Error:** `Error: EAS Project ID not found. Please configure it in app.config.js`

**Solution:** 
```bash
eas init
```
This will add the projectId to your app.config.js automatically.

---

#### 3. Token not registering

**Solution:**
- Check that you granted notification permissions
- Verify your device has internet connection
- Check console logs for errors
- Ensure you're testing on a physical device

---

#### 4. Notifications not appearing

**Possible causes:**
- Token not sent to backend correctly
- Backend not sending push notifications properly
- Device has "Do Not Disturb" enabled
- App has notifications disabled in system settings

**Debugging:**
```typescript
// Add logging to track the flow
useEffect(() => {
  if (expoPushToken) {
    console.log('✅ Token obtained:', expoPushToken);
  } else {
    console.log('❌ No token yet');
  }
}, [expoPushToken]);
```

---

#### 5. Notifications work in development but not in production

**Solution:**
- Ensure you've configured production credentials with `eas credentials`
- Build a production APK/IPA with `eas build --platform android/ios`
- Verify projectId is correct in app.config.js

---

#### 6. iOS: "APNS token not registered"

**Solution:**
```bash
# Configure APNs credentials
eas credentials

# Select your project
# Select iOS
# Select "Push Notifications"
# Follow the prompts to upload your APNs key
```

---

### Debug Checklist

- [ ] Running on physical device (not simulator)
- [ ] Notification permissions granted
- [ ] `projectId` configured in app.config.js
- [ ] Dependencies installed (`expo-notifications`, `expo-device`, `expo-constants`)
- [ ] Token successfully obtained (check console logs)
- [ ] Token sent to backend successfully
- [ ] Backend endpoint returns success
- [ ] Using valid Expo Push Token format

---

## Best Practices

### 1. Handle Token Updates

Tokens can change, so re-register when the app starts:

```typescript
useEffect(() => {
  if (expoPushToken && authToken) {
    registerPushToken(authToken, expoPushToken, deviceId)
      .catch(error => console.error('Failed to register token:', error));
  }
}, [expoPushToken, authToken]);
```

### 2. Clear Token on Logout

```typescript
const handleLogout = async () => {
  try {
    await removePushToken(authToken, deviceId);
  } catch (error) {
    console.error('Failed to remove token:', error);
  }
  // Proceed with logout
};
```

### 3. Handle Notification Taps

Navigate users to relevant screens when they tap notifications:

```typescript
useEffect(() => {
  if (notification?.response) {
    const data = notification.notification.request.content.data;
    
    // Navigate based on notification data
    if (data.screen === 'profile') {
      router.push('/profile');
    } else if (data.screen === 'messages') {
      router.push(`/messages/${data.message_id}`);
    }
  }
}, [notification]);
```

### 4. Category-based Notifications

Set up notification categories for actionable notifications:

```typescript
import * as Notifications from 'expo-notifications';

await Notifications.setNotificationCategoryAsync('message', [
  {
    identifier: 'reply',
    buttonTitle: 'Reply',
    options: { opensAppToForeground: true },
  },
  {
    identifier: 'mark_read',
    buttonTitle: 'Mark as Read',
    options: { opensAppToForeground: false },
  },
]);
```

### 5. Badge Management

Keep badge counts in sync with unread items:

```typescript
import { setBadgeCount } from './lib/notifications';

// When messages are read
const handleMarkAsRead = async () => {
  const unreadCount = await getUnreadMessageCount();
  await setBadgeCount(unreadCount);
};
```

---

## Additional Resources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification Tool](https://expo.dev/notifications)
- [Push Notification Best Practices](https://docs.expo.dev/push-notifications/overview/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [Expo's Push Notification FAQ](https://docs.expo.dev/push-notifications/faq/)
3. Contact: cristian@coconutbreezemedia.com
