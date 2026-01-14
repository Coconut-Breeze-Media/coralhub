# Coral Social API - README

## 📱 REST API for CoralHub

WordPress plugin that provides a complete REST API for social features using BuddyPress and bbPress.

## 🌟 Features

- ✅ **Activity Feed**: Activity feed with likes and comments
- ✅ **Groups**: Creation and management of social groups
- ✅ **Friendships**: Complete friendship request system
- ✅ **Profiles**: Extended user profile management
- ✅ **Mentions**: @mention system with notifications
- ✅ **Comments**: Nested comment system
- ✅ **JWT Authentication**: Secure authentication for mobile apps

## 📋 Requirements

- WordPress 5.8+
- PHP 7.4+
- BuddyPress (required)
- bbPress (optional but recommended)
- JWT Authentication for WP REST API (for mobile apps)

## 🚀 Quick Installation

```bash
# 1. Install BuddyPress from WordPress dashboard
Plugins > Add New > Search "BuddyPress" > Install and Activate

# 2. Copy coral-social-api plugin to plugins folder
wp-content/plugins/coral-social-api/

# 3. Activate the plugin from WordPress dashboard
Plugins > Coral Social API > Activate

# 4. Configure permalinks
Settings > Permalinks > Select "Post name" > Save
```

📖 **Complete installation guide:** See [INSTALLATION.md](./INSTALLATION.md)

## 🔗 Available Endpoints

### 🔐 Authentication
- `POST /jwt-auth/v1/token` - Generate JWT token
- `POST /jwt-auth/v1/token/validate` - Validate JWT token
- `POST /jwt-auth/v1/token/refresh` - Refresh JWT token
- `POST /coral-auth/v1/login` - Login users
- `POST /coral-auth/v1/token/refresh` - Refresh token

### 📋 Activity Feed
- `GET /coral/v1/activity/feed` - Get activity feed
  - Query params: `page`, `per_page`, `scope` (all/friends/groups/mentions), `user_id`, `type`
- `POST /coral/v1/activity/feed` - Create new activity
- `GET /coral/v1/activity/{id}` - Get specific activity
- `PUT /coral/v1/activity/{id}` - Update activity
- `DELETE /coral/v1/activity/{id}` - Delete activity
- `POST /coral/v1/activity/{id}/favorite` - Mark/unmark as favorite
- `POST /coral/v1/activity/{id}/like` - Like/unlike activity

**BuddyPress Reference:**
- `GET /buddypress/v1/activity` - List activities
- `POST /buddypress/v1/activity` - Create activity
- `GET /buddypress/v1/activity/{id}` - Get specific activity
- `PUT /buddypress/v1/activity/{id}` - Update activity
- `DELETE /buddypress/v1/activity/{id}` - Delete activity
- `POST /buddypress/v1/activity/{id}/favorite` - Mark as favorite

### 👥 Groups
- `GET /coral/v1/groups` - List groups
  - Query params: `page`, `per_page`, `type`, `user_id`, `search`
- `POST /coral/v1/groups` - Create group
- `GET /coral/v1/groups/{id}` - Get specific group
- `PUT /coral/v1/groups/{id}` - Update group
- `DELETE /coral/v1/groups/{id}` - Delete group
- `GET /coral/v1/groups/{id}/posts` - Get group posts
- `POST /coral/v1/groups/{id}/posts` - Create post in group
- `GET /coral/v1/groups/{id}/members` - Get group members
- `POST /coral/v1/groups/{id}/members` - Add member to group
- `DELETE /coral/v1/groups/{id}/members/{user_id}` - Remove member
- `POST /coral/v1/groups/{id}/join` - Join group
- `POST /coral/v1/groups/{id}/leave` - Leave group

**BuddyPress Reference:**
- `GET /buddypress/v1/groups` - List groups
- `POST /buddypress/v1/groups` - Create group
- `GET /buddypress/v1/groups/{id}` - Get specific group
- `PUT /buddypress/v1/groups/{id}` - Update group
- `DELETE /buddypress/v1/groups/{id}` - Delete group
- `GET /buddypress/v1/groups/me` - Get current user's groups
- `GET /buddypress/v1/groups/{group_id}/members` - Group members
- `POST /buddypress/v1/groups/{group_id}/members` - Add member
- `DELETE /buddypress/v1/groups/{group_id}/members/{user_id}` - Remove member

### 💬 Comments
- `GET /coral/v1/posts/{id}/comments` - Get comments
  - Query params: `page`, `per_page`
- `POST /coral/v1/posts/{id}/comments` - Create comment
- `PUT /coral/v1/posts/{post_id}/comments/{comment_id}` - Update comment
- `DELETE /coral/v1/posts/{post_id}/comments/{comment_id}` - Delete comment

**BuddyPress Reference:**
- `GET /buddypress/v1/activity?display_comments=threaded` - Get comments
- `POST /buddypress/v1/activity` - Create comment (with type=activity_comment)

### 👤 Users & Profiles
- `GET /coral/v1/users/{id}/profile` - Get user profile
- `PUT /coral/v1/users/{id}/profile` - Update profile
- `GET /coral/v1/users/{id}/friends` - Get user friends
  - Query params: `page`, `per_page`
- `POST /coral/v1/users/{id}/friend-request` - Send friend request
- `POST /coral/v1/users/{id}/accept-friendship` - Accept friendship
- `DELETE /coral/v1/users/{id}/remove-friendship` - Remove friendship
- `GET /coral/v1/users/me/friend-requests` - Pending requests
- `GET /coral/v1/users/{id}/groups` - User's groups
- `GET /coral/v1/users/{id}/activity` - User's activity

**BuddyPress Reference:**
- `GET /buddypress/v1/members/{id}` - Get user profile
- `PUT /buddypress/v1/members/{id}` - Update profile
- `GET /buddypress/v1/xprofile/groups?user_id={id}` - XProfile data
- `GET /buddypress/v1/xprofile/{field_id}/data/{user_id}` - Get specific field
- `PUT /buddypress/v1/xprofile/{field_id}/data/{user_id}` - Update field
- `GET /buddypress/v1/friends?user_id={id}` - List friends
- `POST /buddypress/v1/friends` - Create friendship request
- `GET /buddypress/v1/friends/{id}` - Get friendship details
- `DELETE /buddypress/v1/friends/{id}` - Delete friendship

### @️⃣ Mentions
- `GET /coral/v1/mentions` - Get mentions
  - Query params: `page`, `per_page`, `is_read`
- `POST /coral/v1/mentions/mark-read` - Mark mentions as read
- `GET /coral/v1/mentions/search` - Search users to mention
  - Query params: `q` (search query)

**BuddyPress Reference:**
- `GET /buddypress/v1/activity?scope=mentions` - Activities with mentions
- `GET /buddypress/v1/notifications` - Notifications (includes mentions)

### 🔔 Notifications
**BuddyPress Reference:**
- `GET /buddypress/v1/notifications` - List notifications
- `POST /buddypress/v1/notifications` - Create notification
- `GET /buddypress/v1/notifications/{id}` - Get notification
- `PUT /buddypress/v1/notifications/{id}` - Mark as read
- `DELETE /buddypress/v1/notifications/{id}` - Delete notification

### 🖼️ Avatars & Covers
**BuddyPress Reference:**
- `GET /buddypress/v1/members/{user_id}/avatar` - Get avatar
- `POST /buddypress/v1/members/{user_id}/avatar` - Upload avatar
- `DELETE /buddypress/v1/members/{user_id}/avatar` - Delete avatar
- `GET /buddypress/v1/members/{user_id}/cover` - Get cover
- `POST /buddypress/v1/members/{user_id}/cover` - Upload cover
- `DELETE /buddypress/v1/members/{user_id}/cover` - Delete cover

### 💬 Messages (Private Messages)
**BuddyPress Reference:**
- `GET /buddypress/v1/messages` - List messages/threads
- `POST /buddypress/v1/messages` - Create message/thread
- `GET /buddypress/v1/messages/{id}` - Get thread specific
- `PUT /buddypress/v1/messages/{id}` - Update thread
- `DELETE /buddypress/v1/messages/{id}` - Delete thread
- `POST /buddypress/v1/messages/starred/{id}` - Star message

### 🎯 Coral Specific
- `GET /coral/v1/ping` - Verify API
- `GET /coral/v1/membership` - Membership info
- `GET /coral/v1/levels` - Membership levels

### 🔧 Roles & Permissions
**Redalo Reference:**
- `GET /redalo/v1/roles` - Get available roles
- `GET /redalo/v1/settings` - Role settings configuration
- `POST /redalo/v1/settings` - Update role settings

## 🧪 Testing with Postman

### Import Collection

1. Import the `Coral_Social_API.postman_collection.json` file into Postman
2. Configure environment variables:
   ```
   base_url: https://your-domain.com/wp-json/coral/v1
   jwt_token: (obtained from login)
   ```

### Usage Example

```bash
# 1. Get JWT token
POST https://your-domain.com/wp-json/jwt-auth/v1/token
{
  "username": "admin",
  "password": "password"
}

# 2. Get activity feed
GET https://your-domain.com/wp-json/coral/v1/activity/feed
Authorization: Bearer {token}

# 3. Create post
POST https://your-domain.com/wp-json/coral/v1/activity/feed
Authorization: Bearer {token}
{
  "content": "Hello CoralHub! 🐠"
}
```

📖 **Complete Postman guide:** See [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md)

## 🔐 Authentication

### JWT Token

```javascript
// 1. Get token
const response = await fetch('https://your-domain.com/wp-json/jwt-auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user',
    password: 'password'
  })
});

const { token } = await response.json();

// 2. Use token in requests
const activities = await fetch('https://your-domain.com/wp-json/coral/v1/activity/feed', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 📱 React Native Integration

```typescript
// api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://your-domain.com/wp-json/coral/v1';

const apiClient = axios.create({
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

// Services
export const activityService = {
  getFeed: (page = 1) => 
    apiClient.get('/activity/feed', { params: { page, per_page: 20 } }),
  
  createActivity: (content: string) => 
    apiClient.post('/activity/feed', { content }),
  
  likeActivity: (id: number) => 
    apiClient.post(`/activity/${id}/like`),
};

export const groupsService = {
  getGroups: () => 
    apiClient.get('/groups'),
  
  joinGroup: (id: number) => 
    apiClient.post(`/groups/${id}/join`),
  
  createPost: (groupId: number, content: string) => 
    apiClient.post(`/groups/${groupId}/posts`, { content }),
};
```

## 🎨 Project Structure

```
coral-social-api/
├── coral-social-api.php           # Main plugin file
├── includes/
│   ├── class-activity-endpoint.php    # Activity endpoints
│   ├── class-groups-endpoint.php      # Groups endpoints
│   ├── class-posts-endpoint.php       # Posts/comments endpoints
│   ├── class-users-endpoint.php       # Users endpoints
│   └── class-mentions-endpoint.php    # Mentions endpoints
├── INSTALLATION.md                 # Detailed installation guide
├── POSTMAN_GUIDE.md               # Postman testing guide
├── Coral_Social_API.postman_collection.json  # Postman collection
└── README.md                      # This file
```

## ⚙️ Advanced Configuration

### CORS for Mobile Apps

```php
// Add to wp-config.php or functions.php

add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    
    add_filter('rest_pre_serve_request', function($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        
        if ('OPTIONS' === $_SERVER['REQUEST_METHOD']) {
            status_header(200);
            exit();
        }
        
        return $value;
    });
}, 15);
```

### Rate Limiting

The plugin includes abuse protection with per-user request limits.

## 🐛 Troubleshooting

### BuddyPress is not active
```bash
Error: "BuddyPress is not active"
Solution: Install and activate BuddyPress from Plugins > Add New
```

### 404 error on endpoints
```bash
Error: 404 Not Found
Solution:
1. Go to Settings > Permalinks
2. Select any option except "Plain"
3. Save changes
```

### Invalid JWT token
```bash
Error: "Unauthorized"
Solution:
1. Verify JWT plugin is installed
2. Add JWT_AUTH_SECRET_KEY to wp-config.php
3. Verify token hasn't expired (24 hours by default)
```

## 📊 Response Format

All responses follow this format:

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error
```json
{
  "code": "error_code",
  "message": "Error description",
  "data": {
    "status": 400
  }
}
```

## 🔔 Notifications

The plugin automatically detects mentions (@user) and registers notifications in BuddyPress.

```json
// Create activity with mention
{
  "content": "Hello @johnsmith, what do you think? cc: @maria"
}
```

## 📝 License

GPL v2 or later

## 👥 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For technical support or bug reports:
- Email: support@coralhub.com
- Issues: GitHub Issues
- Documentation: See INSTALLATION.md and POSTMAN_GUIDE.md files

## 🗺️ Roadmap

- [ ] Support for image uploads in activities
- [ ] Video support
- [ ] Push notifications (Firebase/OneSignal)
- [ ] WebSocket for real-time updates
- [ ] Stories support
- [ ] Enhanced private messaging
- [ ] Voice/video calls

## ✅ Version

**Current version:** 1.0.0

### Changelog

#### v1.0.0 (2026-01-14)
- ✅ Initial release
- ✅ Activity endpoints
- ✅ Groups endpoints
- ✅ Users and friendships endpoints
- ✅ Mentions system
- ✅ Comments
- ✅ JWT Authentication
- ✅ Complete documentation

---

Developed with ❤️ for CoralHub
