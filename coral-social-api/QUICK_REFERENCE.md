# Coral Social API - Quick Reference Card

## 🚀 Base URL
```
https://your-domain.com/wp-json/coral/v1
```

## 🔐 Authentication
```bash
# Get Token
POST /jwt-auth/v1/token
{ "username": "user", "password": "pass" }

# Use Token
Authorization: Bearer {token}
```

## 📋 Activity Feed
```bash
GET    /activity/feed               # List activities
POST   /activity/feed               # Create activity
GET    /activity/{id}               # Get activity
PUT    /activity/{id}               # Update activity
DELETE /activity/{id}               # Delete activity
POST   /activity/{id}/favorite      # Favorite/unfavorite
POST   /activity/{id}/like          # Like/unlike
```

## 👥 Groups
```bash
GET    /groups                      # List groups
POST   /groups                      # Create group
GET    /groups/{id}                 # Get group
PUT    /groups/{id}                 # Update group
DELETE /groups/{id}                 # Delete group
GET    /groups/{id}/posts           # Group posts
POST   /groups/{id}/posts           # Create post
GET    /groups/{id}/members         # Members
POST   /groups/{id}/members         # Add member
DELETE /groups/{id}/members/{uid}   # Remove member
POST   /groups/{id}/join            # Join
POST   /groups/{id}/leave           # Leave
```

## 💬 Comments
```bash
GET    /posts/{id}/comments         # List comments
POST   /posts/{id}/comments         # Create comment
PUT    /posts/{pid}/comments/{cid}  # Update comment
DELETE /posts/{pid}/comments/{cid}  # Delete comment
```

## 👤 Users & Profiles
```bash
GET    /users/{id}/profile          # Get profile
PUT    /users/{id}/profile          # Update profile
GET    /users/{id}/friends          # List friends
POST   /users/{id}/friend-request   # Send request
POST   /users/{id}/accept-friendship # Accept
DELETE /users/{id}/remove-friendship # Remove
GET    /users/me/friend-requests    # Pending requests
GET    /users/{id}/groups           # User groups
GET    /users/{id}/activity         # User activity
```

## @️⃣ Mentions
```bash
GET  /mentions                      # Get mentions
POST /mentions/mark-read            # Mark read
GET  /mentions/search?q={query}     # Search users
```

## 🔔 Notifications (BuddyPress Direct)
```bash
GET    /buddypress/v1/notifications
POST   /buddypress/v1/notifications
GET    /buddypress/v1/notifications/{id}
PUT    /buddypress/v1/notifications/{id}
DELETE /buddypress/v1/notifications/{id}
```

## 🖼️ Avatars & Covers (BuddyPress Direct)
```bash
GET    /buddypress/v1/members/{id}/avatar
POST   /buddypress/v1/members/{id}/avatar
DELETE /buddypress/v1/members/{id}/avatar
GET    /buddypress/v1/members/{id}/cover
POST   /buddypress/v1/members/{id}/cover
DELETE /buddypress/v1/members/{id}/cover
```

## 💬 Messages (BuddyPress Direct)
```bash
GET    /buddypress/v1/messages
POST   /buddypress/v1/messages
GET    /buddypress/v1/messages/{id}
PUT    /buddypress/v1/messages/{id}
DELETE /buddypress/v1/messages/{id}
POST   /buddypress/v1/messages/starred/{id}
```

## 📊 Common Query Parameters
```
page=1                    # Page number
per_page=20              # Items per page
scope=all|friends|groups # Activity scope
type=active|newest       # Group type
search=query             # Search term
user_id=123              # Filter by user
group_id=456             # Filter by group
is_read=true|false       # Read status
```

## ✅ Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Success"
}
```

## ❌ Error Response
```json
{
  "code": "error_code",
  "message": "Description",
  "data": { "status": 400 }
}
```

## 🔢 HTTP Status Codes
- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `429` Rate Limited
- `500` Server Error

## 💡 Quick Examples

### Create Post with Mention
```bash
POST /coral/v1/activity/feed
{
  "content": "Hello @johndoe, check this out!"
}
```

### Join Group and Post
```bash
POST /coral/v1/groups/5/join
POST /coral/v1/groups/5/posts
{ "content": "Happy to join!" }
```

### Send Friend Request
```bash
POST /coral/v1/users/10/friend-request
GET  /coral/v1/users/me/friend-requests
POST /coral/v1/users/10/accept-friendship
```

### Like and Comment
```bash
POST /coral/v1/activity/123/like
POST /coral/v1/posts/123/comments
{ "content": "Great post!" }
```

## 🔐 Rate Limiting
- **Limit**: 100 requests/hour/user
- **Response**: 429 Too Many Requests

## 📚 Full Documentation
- [README.md](README.md) - Overview
- [ENDPOINTS.md](ENDPOINTS.md) - Complete reference
- [POSTMAN_GUIDE.md](POSTMAN_GUIDE.md) - Testing guide
- [INSTALLATION.md](INSTALLATION.md) - Setup guide

---

**Version**: 1.0.0 | **Updated**: 2026-01-14
