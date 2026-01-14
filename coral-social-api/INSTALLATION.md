# Installation and Configuration Guide - Coral Social API

## 📋 Prerequisites

- WordPress 5.8 or higher
- PHP 7.4 or higher
- Administrator permissions in WordPress
- FTP or cPanel access

## 🔧 Installation

### Step 1: Install Required Plugins

#### 1.1 Install BuddyPress
```bash
# From WordPress administration panel:
1. Go to Plugins > Add New
2. Search for "BuddyPress"
3. Click "Install Now"
4. Activate the plugin
```

#### 1.2 Install bbPress (Optional but recommended)
```bash
1. Go to Plugins > Add New
2. Search for "bbPress"
3. Click "Install Now"
4. Activate the plugin
```

### Step 2: Configure BuddyPress

```bash
1. Go to Settings > BuddyPress > Components
2. Activate the following components:
   ✅ Extended Profiles
   ✅ Account Settings
   ✅ Friend Connections
   ✅ User Groups
   ✅ Activity Streams
   ✅ Notifications
   ✅ Private Messages (optional)

3. Go to Settings > BuddyPress > Pages
4. Let WordPress create the pages automatically

5. Go to Settings > BuddyPress > Settings
   - Enable activity stream
   - Enable @mentions
   - Configure permissions according to your needs
```

### Step 3: Install Coral Social API

#### Option A: Manual Installation (Recommended)
```bash
1. Copy the coral-social-api folder to:
   /wp-content/plugins/coral-social-api/

2. Ensure the structure is:
   wp-content/plugins/coral-social-api/
   ├── coral-social-api.php
   └── includes/
       ├── class-activity-endpoint.php
       ├── class-groups-endpoint.php
       ├── class-posts-endpoint.php
       ├── class-users-endpoint.php
       └── class-mentions-endpoint.php

3. Go to Plugins in the administration panel
4. Find "Coral Social API"
5. Click "Activate"
```

#### Option B: FTP Installation
```bash
1. Connect via FTP to your server
2. Navigate to /public_html/wp-content/plugins/
3. Upload the coral-social-api folder
4. Activate the plugin from WordPress
```

### Step 4: Configure Permalinks

```bash
1. Go to Settings > Permalinks
2. Select "Post name" or any option except "Plain"
3. Save changes
```

### Step 5: Verify Installation

```bash
1. Go to URL: https://your-domain.com/wp-json/coral/v1/
2. You should see a list of available endpoints

Or verify from terminal:
curl https://your-domain.com/wp-json/coral/v1/activity/feed
```

## 🔐 Configure Permissions and Roles

### BuddyPress Role Configuration

```php
// Add this code to your theme's functions.php or create a customization plugin

// Allow subscribers to create groups
add_filter('bp_is_group_creation_allowed', function() {
    return is_user_logged_in();
});

// Configure custom capabilities
function coral_setup_roles() {
    $subscriber = get_role('subscriber');
    
    // Permissions to create activities
    $subscriber->add_cap('bp_moderate');
    
    // Permissions to create groups
    $subscriber->add_cap('bp_groups_create');
}
add_action('init', 'coral_setup_roles');
```

### Group Privacy Configuration

```bash
1. Go to Settings > BuddyPress > Options
2. Configure privacy options:
   - Public groups: Visible to everyone
   - Private groups: Only members can see
   - Hidden groups: Don't appear in searches
```

## 🔑 JWT Authentication (Recommended for Mobile Apps)

### Install JWT Authentication

```bash
1. Install the plugin "JWT Authentication for WP REST API"
   Plugin URL: https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/

2. Add to wp-config.php file:

define('JWT_AUTH_SECRET_KEY', 'your-secret-key-here');
define('JWT_AUTH_CORS_ENABLE', true);

3. Add to .htaccess file:

RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule ^(.*) - [E=HTTP_AUTHORIZATION:%1]

SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1
```

### JWT Authentication Endpoint

```bash
POST https://your-domain.com/wp-json/jwt-auth/v1/token

Body:
{
  "username": "user",
  "password": "password"
}

Response:
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbG...",
  "user_email": "user@example.com",
  "user_nicename": "user",
  "user_display_name": "User Name"
}
```

## 🎨 Advanced Configuration

### Enable CORS for Mobile Apps

```php
// Add to functions.php or coral-social-api.php plugin

add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    
    add_filter('rest_pre_serve_request', function($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        
        if ('OPTIONS' === $_SERVER['REQUEST_METHOD']) {
            status_header(200);
            exit();
        }
        
        return $value;
    });
}, 15);
```

### Rate Limiting

```php
// Implement request limit per user

function coral_rate_limit_check() {
    $user_id = get_current_user_id();
    
    if (!$user_id) {
        return true;
    }
    
    $limit = 100; // requests per hour
    $transient_key = 'coral_rate_limit_' . $user_id;
    $requests = get_transient($transient_key);
    
    if ($requests === false) {
        set_transient($transient_key, 1, HOUR_IN_SECONDS);
        return true;
    }
    
    if ($requests >= $limit) {
        return new WP_Error('rate_limit_exceeded', 'You have exceeded the request limit', array('status' => 429));
    }
    
    set_transient($transient_key, $requests + 1, HOUR_IN_SECONDS);
    return true;
}

add_filter('rest_pre_dispatch', function($result, $server, $request) {
    if (strpos($request->get_route(), '/coral/v1/') !== false) {
        $rate_check = coral_rate_limit_check();
        if (is_wp_error($rate_check)) {
            return $rate_check;
        }
    }
    return $result;
}, 10, 3);
```

## 📊 Extended Profile Fields

```bash
1. Go to Users > Profile Fields (BuddyPress)
2. Create a new field group called "Personal Information"
3. Add fields:
   - Bio (Textarea)
   - Location (Text)
   - Website (URL)
   - Twitter (Text)
   - LinkedIn (URL)
```

## 🔔 Configure Notifications

```php
// Enable push notifications (requires additional configuration)

// Register custom notification types
bp_notifications_register_notification_type('coral_mention');
bp_notifications_register_notification_type('coral_friend_request');
bp_notifications_register_notification_type('coral_group_invite');

// Hook to send notifications
add_action('bp_activity_mention_notification', 'coral_send_mention_notification', 10, 5);

function coral_send_mention_notification($activity, $subject, $message, $content, $receiver_user_id) {
    // Implement push notification logic here
    // You can use OneSignal, Firebase, etc.
}
```

## 🧪 Installation Verification

### Verification Script

```bash
# Execute from terminal or browser

curl -X GET "https://your-domain.com/wp-json/coral/v1/activity/feed" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return:
{
  "success": true,
  "data": [],
  "total": 0,
  "page": 1,
  "per_page": 20
}
```

## ⚠️ Troubleshooting

### Error: "BuddyPress is not active"
```bash
Solution: Install and activate BuddyPress from Plugins > Add New
```

### Error: 404 on endpoints
```bash
Solution:
1. Go to Settings > Permalinks
2. Save again (without changing anything)
3. This will refresh the rewrite rules
```

### Error: "Unauthorized"
```bash
Solution:
1. Verify you're sending the JWT token in the header
2. Verify the token hasn't expired
3. Correct header: Authorization: Bearer {token}
```

### CORS Error
```bash
Solution: Add the CORS code to .htaccess file:

<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Authorization, Content-Type"
</IfModule>
```

## 📱 Configuration for React Native

```javascript
// api.ts - API client configuration

const API_URL = 'https://your-domain.com/wp-json/coral/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

## 🎯 Next Step

Review the `POSTMAN_GUIDE.md` file to see all available endpoints and usage examples.
