# Postman Testing Guide - Coral Social API

## 🚀 Quick Start

### 1. Import Collection into Postman

1. Open Postman
2. Click on "Import"
3. Select the file `Coral_Social_API.postman_collection.json`
4. The collection will be imported with all endpoints

### 2. Configure Variables

Before testing the endpoints, configure these variables in Postman:

```
base_url: https://your-domain.com/wp-json/coral/v1
jwt_token: (will be filled automatically after login)
user_id: 1
group_id: 1
activity_id: 1
```

**How to configure:**
1. Right-click on the collection "Coral Social API"
2. Select "Edit"
3. Go to the "Variables" tab
4. Update the value of `base_url` with your domain

## 📋 Complete Endpoint List

### 🔐 Authentication Endpoints
- `POST /jwt-auth/v1/token` - Generate JWT token
- `POST /jwt-auth/v1/token/validate` - Validate JWT token
- `POST /jwt-auth/v1/token/refresh` - Refresh JWT token

### 📋 Activity Feed Endpoints
- `GET /coral/v1/activity/feed` - Get activity feed (with filters)
- `POST /coral/v1/activity/feed` - Create new activity
- `GET /coral/v1/activity/{id}` - Get specific activity
- `PUT /coral/v1/activity/{id}` - Update activity
- `DELETE /coral/v1/activity/{id}` - Delete activity
- `POST /coral/v1/activity/{id}/favorite` - Mark/unmark as favorite
- `POST /coral/v1/activity/{id}/like` - Like/unlike activity

### 👥 Groups Endpoints
- `GET /coral/v1/groups` - List all groups (with filters)
- `POST /coral/v1/groups` - Create new group
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

### 💬 Comments Endpoints
- `GET /coral/v1/posts/{id}/comments` - Get comments for a post
- `POST /coral/v1/posts/{id}/comments` - Create comment
- `PUT /coral/v1/posts/{post_id}/comments/{comment_id}` - Update comment
- `DELETE /coral/v1/posts/{post_id}/comments/{comment_id}` - Delete comment

### 👤 Users & Profiles Endpoints
- `GET /coral/v1/users/{id}/profile` - Get user profile
- `PUT /coral/v1/users/{id}/profile` - Update profile
- `GET /coral/v1/users/{id}/friends` - Get user friends
- `POST /coral/v1/users/{id}/friend-request` - Send friend request
- `POST /coral/v1/users/{id}/accept-friendship` - Accept friend request
- `DELETE /coral/v1/users/{id}/remove-friendship` - Remove/reject friendship
- `GET /coral/v1/users/me/friend-requests` - Pending friend requests
- `GET /coral/v1/users/{id}/groups` - User's groups
- `GET /coral/v1/users/{id}/activity` - User's activity

### @️⃣ Mentions Endpoints
- `GET /coral/v1/mentions` - Get user mentions
- `POST /coral/v1/mentions/mark-read` - Mark mentions as read
- `GET /coral/v1/mentions/search?q={query}` - Search users to mention (autocomplete)

### 🔔 BuddyPress Notifications (Direct Access)
- `GET /buddypress/v1/notifications` - List notifications
- `POST /buddypress/v1/notifications` - Create notification
- `GET /buddypress/v1/notifications/{id}` - Get notification
- `PUT /buddypress/v1/notifications/{id}` - Mark as read
- `DELETE /buddypress/v1/notifications/{id}` - Delete notification

### 🖼️ BuddyPress Avatars & Covers (Direct Access)
- `GET /buddypress/v1/members/{user_id}/avatar` - Get avatar
- `POST /buddypress/v1/members/{user_id}/avatar` - Upload avatar
- `DELETE /buddypress/v1/members/{user_id}/avatar` - Delete avatar
- `GET /buddypress/v1/members/{user_id}/cover` - Get cover image
- `POST /buddypress/v1/members/{user_id}/cover` - Upload cover
- `DELETE /buddypress/v1/members/{user_id}/cover` - Delete cover

### 💬 BuddyPress Private Messages (Direct Access)
- `GET /buddypress/v1/messages` - List message threads
- `POST /buddypress/v1/messages` - Create message/thread
- `GET /buddypress/v1/messages/{id}` - Get specific thread
- `PUT /buddypress/v1/messages/{id}` - Update thread
- `DELETE /buddypress/v1/messages/{id}` - Delete thread
- `POST /buddypress/v1/messages/starred/{id}` - Star message

## 🔐 Authentication

### Step 1: Get JWT Token

**Endpoint:** `POST /wp-json/jwt-auth/v1/token`

```bash
curl -X POST "https://your-domain.com/wp-json/jwt-auth/v1/token" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user_email": "admin@example.com",
  "user_nicename": "admin",
  "user_display_name": "Administrator"
}
```

**In Postman:**
1. Run "Login - Get JWT Token"
2. Copy the `token` value from the response
3. Paste the token into the `jwt_token` variable

### Step 2: Validate Token (Optional)

```bash
curl -X POST "https://your-domain.com/wp-json/jwt-auth/v1/token/validate" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📋 Endpoints by Category

### 1️⃣ Activity Feed

#### Get Activity Feed
```bash
GET {{base_url}}/activity/feed?page=1&per_page=20&scope=all
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 20)
- `scope` (optional): all, friends, groups, mentions
- `user_id` (optional): Filter by specific user
- `type` (optional): Activity type

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "user_id": 1,
      "user": {
        "id": 1,
        "name": "John Doe",
        "avatar": "https://...",
        "profile_url": "https://..."
      },
      "content": "Hello everyone!",
      "type": "activity_update",
      "date_recorded": "2026-01-14 10:30:00",
      "likes_count": 5,
      "has_liked": false,
      "comments_count": 3
    }
  ],
  "total": 100,
  "page": 1,
  "per_page": 20
}
```

#### Create New Activity
```bash
POST {{base_url}}/activity/feed
Content-Type: application/json

{
  "content": "My first post! 🎉",
  "type": "activity_update"
}
```

#### Like Activity
```bash
POST {{base_url}}/activity/123/like
```

**Response:**
```json
{
  "success": true,
  "action": "liked",
  "likes_count": 6
}
```

#### Delete Activity
```bash
DELETE {{base_url}}/activity/123
```

---

### 2️⃣ Groups

#### List All Groups
```bash
GET {{base_url}}/groups?page=1&per_page=20&type=active
```

**Query Parameters:**
- `page`: Page number
- `per_page`: Items per page
- `type`: active, newest, alphabetical, random, popular
- `search`: Search by name

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Coral Lovers",
      "description": "Group dedicated to...",
      "slug": "coral-lovers",
      "status": "public",
      "avatar": "https://...",
      "total_member_count": 25,
      "is_member": true,
      "is_admin": false
    }
  ],
  "total": 10,
  "page": 1,
  "per_page": 20
}
```

#### Create New Group
```bash
POST {{base_url}}/groups
Content-Type: application/json

{
  "name": "Marine Conservation",
  "description": "Group dedicated to marine ecosystem conservation",
  "status": "public"
}
```

**Status values:**
- `public`: Public group (everyone can see and join)
- `private`: Private group (everyone can see, request to join)
- `hidden`: Hidden group (only members can see)

#### Join a Group
```bash
POST {{base_url}}/groups/1/join
```

#### Get Group Posts
```bash
GET {{base_url}}/groups/1/posts?page=1&per_page=20
```

#### Create Post in Group
```bash
POST {{base_url}}/groups/1/posts
Content-Type: application/json

{
  "content": "Important new information for the group! 🪸"
}
```

#### Get Group Members
```bash
GET {{base_url}}/groups/1/members
```

---

### 3️⃣ Comments

#### Get Comments from a Post
```bash
GET {{base_url}}/posts/123/comments?page=1&per_page=20
```

#### Create Comment
```bash
POST {{base_url}}/posts/123/comments
Content-Type: application/json

{
  "content": "Excellent post! 👍"
}
```

#### Update Comment
```bash
PUT {{base_url}}/posts/123/comments/456
Content-Type: application/json

{
  "content": "Updated comment"
}
```

#### Delete Comment
```bash
DELETE {{base_url}}/posts/123/comments/456
```

---

### 4️⃣ User Profiles

#### Get User Profile
```bash
GET {{base_url}}/users/1/profile
```

**Response Example:**
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
    "website": "https://mywebsite.com",
    "friends_count": 50,
    "groups_count": 5,
    "friendship_status": "not_friends",
    "is_friend": false
  }
}
```

#### Update Profile
```bash
PUT {{base_url}}/users/1/profile
Content-Type: application/json

{
  "display_name": "John Doe",
  "bio": "Marine biologist and conservationist",
  "location": "Cancun, Mexico",
  "website": "https://johndoe.com"
}
```

#### Get User Activity
```bash
GET {{base_url}}/users/1/activity
```

#### Get User Groups
```bash
GET {{base_url}}/users/1/groups
```

---

### 5️⃣ Friendships

#### Get Friends List
```bash
GET {{base_url}}/users/1/friends?page=1&per_page=20
```

#### Send Friend Request
```bash
POST {{base_url}}/users/2/friend-request
```

**Response:**
```json
{
  "success": true,
  "message": "Friend request sent successfully"
}
```

#### Get Pending Requests
```bash
GET {{base_url}}/users/me/friend-requests
```

**Response Example:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "username": "maria_garcia",
      "display_name": "Maria Garcia",
      "avatar": "https://...",
      "profile_url": "https://..."
    }
  ],
  "total": 1
}
```

#### Accept Friend Request
```bash
POST {{base_url}}/users/5/accept-friendship
```

#### Remove Friendship
```bash
DELETE {{base_url}}/users/2/remove-friendship
```

---

### 6️⃣ Mentions

#### Get Mentions
```bash
GET {{base_url}}/mentions?page=1&per_page=20&is_read=false
```

**Parameters:**
- `is_read` (optional): true (read), false (unread), omit (all)

#### Mark Mentions as Read
```bash
POST {{base_url}}/mentions/mark-read
Content-Type: application/json

{
  "mention_ids": [123, 124, 125]
}
```

#### Search Users to Mention
```bash
GET {{base_url}}/mentions/search?q=john
```

**Response Example:**
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

---

## 🧪 Complete Testing Scenarios

### Scenario 1: New User Creates Content

```bash
# 1. Login
POST /jwt-auth/v1/token
{
  "username": "new_user",
  "password": "password"
}

# 2. Update profile
PUT /coral/v1/users/5/profile
{
  "display_name": "New User",
  "bio": "New to CoralHub"
}

# 3. Create first post
POST /coral/v1/activity/feed
{
  "content": "Hello everyone! First post 🎉"
}

# 4. Search groups
GET /coral/v1/groups?type=active&per_page=10

# 5. Join a group
POST /coral/v1/groups/1/join

# 6. Post in the group
POST /coral/v1/groups/1/posts
{
  "content": "Happy to be part of this group!"
}
```

### Scenario 2: Social Interaction

```bash
# 1. View friends feed
GET /coral/v1/activity/feed?scope=friends

# 2. Like a post
POST /coral/v1/activity/123/like

# 3. Comment on post
POST /coral/v1/posts/123/comments
{
  "content": "I love this post! 👍"
}

# 4. Send friend request
POST /coral/v1/users/10/friend-request

# 5. View pending requests
GET /coral/v1/users/me/friend-requests

# 6. Accept request
POST /coral/v1/users/8/accept-friendship
```

### Scenario 3: Group Management

```bash
# 1. Create new group
POST /coral/v1/groups
{
  "name": "Underwater Photography",
  "description": "Share ocean photos",
  "status": "public"
}

# 2. View group members
GET /coral/v1/groups/5/members

# 3. Post in the group
POST /coral/v1/groups/5/posts
{
  "content": "Welcome to the photography group 📷"
}

# 4. View group posts
GET /coral/v1/groups/5/posts

# 5. Update group information
PUT /coral/v1/groups/5
{
  "description": "Group for marine photography enthusiasts"
}
```

---

## 🐛 Common Error Responses

### Error 401: Unauthorized
```json
{
  "code": "rest_forbidden",
  "message": "Sorry, you are not allowed to do that.",
  "data": {
    "status": 401
  }
}
```
**Solution:** Verify that the JWT token is present and valid.

### Error 404: Not Found
```json
{
  "code": "activity_not_found",
  "message": "Activity not found",
  "data": {
    "status": 404
  }
}
```
**Solution:** Verify that the resource ID exists.

### Error 400: Bad Request
```json
{
  "code": "empty_content",
  "message": "Comment cannot be empty",
  "data": {
    "status": 400
  }
}
```
**Solution:** Verify that all required fields are present.

### Error 403: Forbidden
```json
{
  "code": "unauthorized",
  "message": "You don't have permission to delete this activity",
  "data": {
    "status": 403
  }
}
```
**Solution:** Verify that you have the necessary permissions for the action.

---

## 💡 Tips and Best Practices

### 1. Use Environment Variables in Postman
Configure different environments (Development, Staging, Production):
```
Development: http://localhost:8000/wp-json/coral/v1
Staging: https://staging.coralhub.com/wp-json/coral/v1
Production: https://coralhub.com/wp-json/coral/v1
```

### 2. Save IDs in Variables
After creating resources, save their IDs:
```javascript
// In Postman Tests
var jsonData = pm.response.json();
pm.environment.set("activity_id", jsonData.data.id);
```

### 3. Automate Tests
Use Postman Tests to validate responses:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.eql(true);
});
```

### 4. Mentions with @user
When creating content with mentions:
```json
{
  "content": "Hello @johndoe, what do you think about this? cc: @maria"
}
```

---

## 📞 Support

If you encounter problems:
1. Verify that BuddyPress is active
2. Confirm that permalinks are configured
3. Check WordPress logs in wp-content/debug.log
4. Verify that the JWT token hasn't expired

## 🔄 Next Steps

1. Integrate the endpoints into your React Native app
2. Implement local cache to improve performance
3. Add push notifications
4. Implement image upload in posts
5. Add support for videos and media
