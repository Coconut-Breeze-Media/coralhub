# Coral Social API - Complete Endpoint Reference

## 📚 Overview

This document provides a complete reference of all available endpoints in the Coral Social API. The API is divided into custom Coral endpoints and direct BuddyPress REST API endpoints.

## 🔑 Base URLs

- **Coral API**: `https://your-domain.com/wp-json/coral/v1`
- **BuddyPress API**: `https://your-domain.com/wp-json/buddypress/v1`
- **JWT Auth**: `https://your-domain.com/wp-json/jwt-auth/v1`

## 🔐 Authentication Endpoints

### JWT Token Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jwt-auth/v1/token` | Generate JWT token (login) |
| POST | `/jwt-auth/v1/token/validate` | Validate JWT token |
| POST | `/jwt-auth/v1/token/refresh` | Refresh JWT token |
| POST | `/coral-auth/v1/login` | Login users |
| POST | `/coral-auth/v1/token/refresh` | Refresh token |
| POST | `/coral/v1/auth/lost-password` | Request a password reset email (public, rate limited 5 / 15 min per IP) |

**Example - Get JWT Token:**
```bash
POST /jwt-auth/v1/token
Content-Type: application/json

{
  "username": "user",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGci...",
  "user_email": "user@example.com",
  "user_nicename": "user",
  "user_display_name": "User Name"
}
```

---

## 📋 Activity Feed Endpoints

### Coral Custom Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/coral/v1/activity/feed` | Get activity feed | ✅ |
| POST | `/coral/v1/activity/feed` | Create new activity | ✅ |
| GET | `/coral/v1/activity/{id}` | Get specific activity | ✅ |
| PUT | `/coral/v1/activity/{id}` | Update activity | ✅ |
| DELETE | `/coral/v1/activity/{id}` | Delete activity | ✅ |
| POST | `/coral/v1/activity/{id}/favorite` | Mark/unmark as favorite | ✅ |
| POST | `/coral/v1/activity/{id}/like` | Like/unlike activity | ✅ |

**Query Parameters for GET /activity/feed:**
- `page` (int): Page number (default: 1)
- `per_page` (int): Items per page (default: 20)
- `scope` (string): all, friends, groups, favorites, mentions (default: all)
- `user_id` (int): Filter by user ID
- `type` (string): Activity type filter
- `group_id` (int): Filter by group ID
- `component` (string): Component filter

**Example - Get Activity Feed:**
```bash
GET /coral/v1/activity/feed?scope=friends&per_page=10
Authorization: Bearer {token}
```

**Example - Create Activity:**
```bash
POST /coral/v1/activity/feed
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Hello everyone! 🌊",
  "type": "activity_update"
}
```

### BuddyPress Native Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/buddypress/v1/activity` | List activities |
| POST | `/buddypress/v1/activity` | Create activity |
| GET | `/buddypress/v1/activity/{id}` | Get specific activity |
| PUT | `/buddypress/v1/activity/{id}` | Update activity |
| DELETE | `/buddypress/v1/activity/{id}` | Delete activity |
| POST | `/buddypress/v1/activity/{id}/favorite` | Mark as favorite |

---

## 👥 Groups Endpoints

### Coral Custom Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/coral/v1/groups` | List all groups | ✅ |
| POST | `/coral/v1/groups` | Create new group | ✅ |
| GET | `/coral/v1/groups/{id}` | Get specific group | ✅ |
| PUT | `/coral/v1/groups/{id}` | Update group | ✅ |
| DELETE | `/coral/v1/groups/{id}` | Delete group | ✅ |
| GET | `/coral/v1/groups/{id}/posts` | Get group posts | ✅ |
| POST | `/coral/v1/groups/{id}/posts` | Create post in group | ✅ |
| GET | `/coral/v1/groups/{id}/members` | Get group members | ✅ |
| POST | `/coral/v1/groups/{id}/members` | Add member to group | ✅ |
| DELETE | `/coral/v1/groups/{id}/members/{user_id}` | Remove member | ✅ |
| POST | `/coral/v1/groups/{id}/join` | Join group | ✅ |
| POST | `/coral/v1/groups/{id}/leave` | Leave group | ✅ |

**Query Parameters for GET /groups:**
- `page` (int): Page number
- `per_page` (int): Items per page
- `type` (string): active, newest, alphabetical, random, popular
- `user_id` (int): Filter by user's groups
- `search` (string): Search term

**Example - Create Group:**
```bash
POST /coral/v1/groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Marine Conservation",
  "description": "Group dedicated to ocean conservation",
  "status": "public"
}
```

**Status Options:**
- `public`: Everyone can see and join
- `private`: Everyone can see, request to join
- `hidden`: Only members can see

### BuddyPress Native Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/buddypress/v1/groups` | List groups |
| POST | `/buddypress/v1/groups` | Create group |
| GET | `/buddypress/v1/groups/{id}` | Get specific group |
| PUT | `/buddypress/v1/groups/{id}` | Update group |
| DELETE | `/buddypress/v1/groups/{id}` | Delete group |
| GET | `/buddypress/v1/groups/me` | Get current user's groups |
| GET | `/buddypress/v1/groups/{group_id}/members` | List group members |
| POST | `/buddypress/v1/groups/{group_id}/members` | Add member |
| DELETE | `/buddypress/v1/groups/{group_id}/members/{user_id}` | Remove member |

---

## 💬 Comments Endpoints

### Coral Custom Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/coral/v1/posts/{id}/comments` | Get comments for post | ✅ |
| POST | `/coral/v1/posts/{id}/comments` | Create comment | ✅ |
| PUT | `/coral/v1/posts/{post_id}/comments/{comment_id}` | Update comment | ✅ |
| DELETE | `/coral/v1/posts/{post_id}/comments/{comment_id}` | Delete comment | ✅ |

**Query Parameters for GET /posts/{id}/comments:**
- `page` (int): Page number
- `per_page` (int): Items per page

**Example - Create Comment:**
```bash
POST /coral/v1/posts/123/comments
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Great post! 👍"
}
```

### BuddyPress Native Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/buddypress/v1/activity?display_comments=threaded` | Get comments |
| POST | `/buddypress/v1/activity` | Create comment (type=activity_comment) |

---

## 👤 Users & Profiles Endpoints

### Coral Custom Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/coral/v1/users/{id}/profile` | Get user profile | ✅ |
| PUT | `/coral/v1/users/{id}/profile` | Update profile | ✅ |
| GET | `/coral/v1/users/{id}/friends` | Get user friends | ✅ |
| POST | `/coral/v1/users/{id}/friend-request` | Send friend request | ✅ |
| POST | `/coral/v1/users/{id}/accept-friendship` | Accept friend request | ✅ |
| DELETE | `/coral/v1/users/{id}/remove-friendship` | Remove friendship | ✅ |
| GET | `/coral/v1/users/me/friend-requests` | Pending friend requests | ✅ |
| GET | `/coral/v1/users/{id}/groups` | User's groups | ✅ |
| GET | `/coral/v1/users/{id}/activity` | User's activity | ✅ |

**Example - Get User Profile:**
```bash
GET /coral/v1/users/1/profile
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "display_name": "John Doe",
    "email": "john@example.com",
    "avatar": "https://...",
    "bio": "Ocean enthusiast",
    "location": "Cancun, Mexico",
    "website": "https://example.com",
    "friends_count": 50,
    "groups_count": 5,
    "friendship_status": "not_friends",
    "is_friend": false
  }
}
```

**Example - Update Profile:**
```bash
PUT /coral/v1/users/1/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "display_name": "John Doe",
  "bio": "Marine biologist and conservationist",
  "location": "Cancun, Mexico",
  "website": "https://johndoe.com"
}
```

### BuddyPress Native Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/buddypress/v1/members/{id}` | Get user profile |
| PUT | `/buddypress/v1/members/{id}` | Update profile |
| GET | `/buddypress/v1/xprofile/groups?user_id={id}` | Get XProfile data |
| GET | `/buddypress/v1/xprofile/{field_id}/data/{user_id}` | Get specific field |
| PUT | `/buddypress/v1/xprofile/{field_id}/data/{user_id}` | Update field |
| GET | `/buddypress/v1/friends?user_id={id}` | List friends |
| POST | `/buddypress/v1/friends` | Create friendship request |
| GET | `/buddypress/v1/friends/{id}` | Get friendship details |
| DELETE | `/buddypress/v1/friends/{id}` | Delete friendship |

---

## @️⃣ Mentions Endpoints

### Coral Custom Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/coral/v1/mentions` | Get user mentions | ✅ |
| POST | `/coral/v1/mentions/mark-read` | Mark mentions as read | ✅ |
| GET | `/coral/v1/mentions/search` | Search users (autocomplete) | ✅ |

**Query Parameters for GET /mentions:**
- `page` (int): Page number
- `per_page` (int): Items per page
- `is_read` (bool): Filter by read status (true/false)

**Example - Get Mentions:**
```bash
GET /coral/v1/mentions?is_read=false&per_page=20
Authorization: Bearer {token}
```

**Example - Search Users:**
```bash
GET /coral/v1/mentions/search?q=john
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "johndoe",
      "display_name": "John Doe",
      "mention_name": "@johndoe",
      "avatar": "https://..."
    }
  ],
  "total": 1
}
```

### BuddyPress Native Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/buddypress/v1/activity?scope=mentions` | Activities with mentions |
| GET | `/buddypress/v1/notifications` | Notifications (includes mentions) |

---

## 🔔 Notifications Endpoints

### BuddyPress Native Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/buddypress/v1/notifications` | List notifications | ✅ |
| POST | `/buddypress/v1/notifications` | Create notification | ✅ |
| GET | `/buddypress/v1/notifications/{id}` | Get notification | ✅ |
| PUT | `/buddypress/v1/notifications/{id}` | Mark as read | ✅ |
| DELETE | `/buddypress/v1/notifications/{id}` | Delete notification | ✅ |

**Example - Get Notifications:**
```bash
GET /buddypress/v1/notifications?per_page=20
Authorization: Bearer {token}
```

---

## 🖼️ Avatars & Covers Endpoints

### BuddyPress Native Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/buddypress/v1/members/{user_id}/avatar` | Get avatar | ✅ |
| POST | `/buddypress/v1/members/{user_id}/avatar` | Upload avatar | ✅ |
| DELETE | `/buddypress/v1/members/{user_id}/avatar` | Delete avatar | ✅ |
| GET | `/buddypress/v1/members/{user_id}/cover` | Get cover | ✅ |
| POST | `/buddypress/v1/members/{user_id}/cover` | Upload cover | ✅ |
| DELETE | `/buddypress/v1/members/{user_id}/cover` | Delete cover | ✅ |

**Example - Upload Avatar:**
```bash
POST /buddypress/v1/members/1/avatar
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary image data]
```

---

## 💬 Private Messages Endpoints

### BuddyPress Native Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/buddypress/v1/messages` | List message threads | ✅ |
| POST | `/buddypress/v1/messages` | Create message/thread | ✅ |
| GET | `/buddypress/v1/messages/{id}` | Get specific thread | ✅ |
| PUT | `/buddypress/v1/messages/{id}` | Update thread | ✅ |
| DELETE | `/buddypress/v1/messages/{id}` | Delete thread | ✅ |
| POST | `/buddypress/v1/messages/starred/{id}` | Star message | ✅ |

**Example - Create Message:**
```bash
POST /buddypress/v1/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipients": [2, 3],
  "subject": "Hello",
  "message": "Hey, how are you?"
}
```

---

## 🔧 Roles & Permissions Endpoints

### Redalo Plugin Endpoints (if installed)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/redalo/v1/roles` | Get available roles | ✅ |
| GET | `/redalo/v1/settings` | Get role settings | ✅ |
| POST | `/redalo/v1/settings` | Update role settings | ✅ (Admin) |

---

## 🎯 Coral Specific Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/coral/v1/ping` | Verify API status | ❌ |
| GET | `/coral/v1/membership` | Get membership info | ✅ |
| GET | `/coral/v1/levels` | Get membership levels | ✅ |

---

## 📊 Standard Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "code": "error_code",
  "message": "Error description",
  "data": {
    "status": 400
  }
}
```

## 🔐 Authentication

All endpoints (except `/coral/v1/ping`) require JWT authentication. Include the token in the request header:

```
Authorization: Bearer {your_jwt_token}
```

## ⚡ Rate Limiting

The API implements rate limiting per user:
- **Limit**: 100 requests per hour per user
- **Response Code**: 429 (Too Many Requests)

## 📝 Notes

1. **Pagination**: Most list endpoints support `page` and `per_page` parameters
2. **Filtering**: Many endpoints support additional query parameters for filtering
3. **Permissions**: Some actions require specific user permissions (e.g., group admin)
4. **BuddyPress**: Some endpoints are direct BuddyPress REST API endpoints
5. **Mentions**: Use `@username` format in content to mention users

## 🐛 Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 📚 Additional Resources

- [README.md](README.md) - Main documentation
- [INSTALLATION.md](INSTALLATION.md) - Installation guide
- [POSTMAN_GUIDE.md](POSTMAN_GUIDE.md) - Postman testing guide
- [BuddyPress REST API Reference](https://developer.buddypress.org/api/)

---

**Version:** 1.0.0  
**Last Updated:** 2026-01-14
