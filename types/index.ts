// types/index.ts
/**
 * Centralized type definitions for CoralHub application
 */

// ============================================
// API & WordPress Types
// ============================================

/**
 * JWT authentication payload from WordPress
 */
export interface JWTPayload {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

/**
 * Membership status response from WordPress
 */
export interface MembershipResponse {
  is_member: boolean;
  user_id?: number;
  roles?: string[];
}

/**
 * WordPress page object
 */
export interface WPPage {
  id: number;
  slug: string;
  content: {
    rendered: string;
  };
}

/**
 * WordPress post object with embedded data
 */
export interface WPPost {
  id: number;
  date: string;
  title: {
    rendered: string;
  };
  excerpt?: {
    rendered: string;
  };
  content?: {
    rendered: string;
  };
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url?: string;
      media_details?: {
        sizes?: {
          medium_large?: { source_url?: string };
          medium?: { source_url?: string };
        };
      };
    }>;
    author?: Array<{
      id: number;
      name: string;
      avatar_urls?: Record<string, string>;
    }>;
  };
}

/**
 * WordPress user object (from /users/me endpoint)
 */
export interface WPUser {
  id: number;
  name: string;
  email?: string;
  username?: string;
  roles?: string[];
  avatar_urls?: Record<string, string>;
}

/**
 * Membership level/plan definition
 */
export interface MembershipLevel {
  id: number;
  name: string;
  price: string;
  note: string;
  description: string;
  benefits: string[];
  checkout_url: string;
}

// ============================================
// BuddyPress Member Types
// ============================================

/**
 * BuddyPress member object
 */
export interface BPMember {
  id: number;
  name: string;
  mention_name?: string;
  link?: string;
  user_login?: string;
  member_types?: string[];
  registered_date?: string;
  registered_date_gmt?: string;
  password?: string;
  roles?: string[];
  capabilities?: Record<string, boolean>;
  extra_capabilities?: Record<string, boolean>;
  xprofile?: Array<{
    field_id: number;
    name: string;
    value: {
      raw: string;
      rendered: string;
    };
  }>;
  friendship_status?: boolean;
  friendship_status_slug?: string;
  last_activity?: {
    timediff: string;
    date: string;
    date_gmt: string;
  };
  latest_update?: {
    id: number;
    raw: string;
    rendered: string;
  };
  total_friend_count?: number;
  avatar_urls?: {
    full: string;
    thumb: string;
  };
}

/**
 * Update member profile payload
 */
export interface UpdateMemberPayload {
  name?: string;
  member_type?: string;
}

/**
 * BuddyPress avatar response
 */
export interface BPAvatar {
  full: string;
  thumb: string;
}

/**
 * BuddyPress cover image response
 */
export interface BPCoverImage {
  image: string;
}

/**
 * XProfile field data
 */
export interface XProfileFieldData {
  id: number;
  user_id: number;
  field_id: number;
  value: {
    raw: string;
    rendered: string;
  };
  last_updated: string;
}

/**
 * Update XProfile field payload
 */
export interface UpdateXProfilePayload {
  value: string;
}

/**
 * BuddyPress activity item
 */
export interface BPActivity {
  id: number;
  primary_item_id: number;
  secondary_item_id: number;
  user_id: number;
  link: string;
  component: string;
  type: string;
  title: string;
  content: string | { rendered: string; raw?: string };
  date: string;
  date_gmt: string;
  user_avatar?: string | { full: string; thumb: string };
  user_name?: string;
  favorited?: boolean;
  favorite_count?: number;
  comment_count?: number;
}

/**
 * BuddyPress message text payload
 */
export interface BPMessageText {
  rendered?: string;
  raw?: string;
}

/**
 * BuddyPress message participant summary
 */
export interface BPMessageParticipant {
  id?: number | string;
  user_id?: number | string;
  name?: string;
  display_name?: string;
  sender_name?: string;
  user_name?: string;
  username?: string;
  full_name?: string;
}

/**
 * BuddyPress conversation summary item
 */
export interface BPConversationSummary {
  id?: number | string;
  thread_id?: number | string;
  subject?: string | BPMessageText;
  last_message_content?: string | BPMessageText;
  unread_count?: number;
  participants?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  recipients?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  users?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  members?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  participant_names?: string[] | Record<string, string>;
  recipient_names?: string[] | Record<string, string>;
  user_names?: string[] | Record<string, string>;
}

/**
 * BuddyPress conversation list wrapper
 */
export interface BPConversationListResponse {
  threads?: BPConversationSummary[];
  messages?: BPConversationSummary[];
  items?: BPConversationSummary[];
}

/**
 * BuddyPress message item
 */
export interface BPMessageItem {
  id?: number | string;
  message_id?: number | string;
  sender_id?: number | string;
  user_id?: number | string;
  sender?: BPMessageParticipant;
  user?: BPMessageParticipant;
  sender_name?: string;
  display_name?: string;
  user_name?: string;
  message?: string | BPMessageText;
  content?: string | BPMessageText;
  subject?: string | BPMessageText;
  date_sent?: string | number;
  date?: string | number;
  date_gmt?: string | number;
  created_at?: string | number;
}

/**
 * BuddyPress message thread response
 */
export interface BPMessageThreadResponse {
  id?: number | string;
  thread_id?: number | string;
  subject?: string | BPMessageText;
  messages?: BPMessageItem[] | Record<string, BPMessageItem>;
  items?: BPMessageItem[] | Record<string, BPMessageItem>;
  participants?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  recipients?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  users?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  members?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
  participant_names?: string[] | Record<string, string>;
  recipient_names?: string[] | Record<string, string>;
  user_names?: string[] | Record<string, string>;
  thread?: {
    subject?: string | BPMessageText;
    messages?: BPMessageItem[] | Record<string, BPMessageItem>;
    items?: BPMessageItem[] | Record<string, BPMessageItem>;
    participants?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
    recipients?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
    users?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
    members?: BPMessageParticipant[] | Record<string, BPMessageParticipant>;
    participant_names?: string[] | Record<string, string>;
    recipient_names?: string[] | Record<string, string>;
    user_names?: string[] | Record<string, string>;
  };
}

export type BPConversationsResponse =
  | BPConversationSummary[]
  | BPConversationListResponse;

export type BPMessageThreadResult =
  | BPMessageThreadResponse
  | BPMessageItem[];

export type BPMessageMutationResponse =
  | BPMessageThreadResponse
  | BPConversationSummary;

/**
 * WordPress comment object (from /wp/v2/comments endpoint)
 */
export interface WPComment {
  id: number;
  post: number;
  parent: number;
  author: number;
  author_name: string;
  author_avatar_urls?: Record<string, string>;
  date: string;
  content: {
    rendered: string;
  };
  status: string;
}

/**
 * Create activity post payload
 */
export interface CreateActivityPayload {
  content: string;
  component?: string;
  type?: string;
  primary_item_id?: number;
}

/**
 * Activity feed response with pagination
 */
export interface ActivityFeedResponse {
  activities: BPActivity[];
  total: number;
  pages: number;
}

// ============================================
// BuddyPress Groups Types
// ============================================

/**
 * BuddyPress group
 */
export interface BPGroup {
  id: number;
  creator_id: number;
  name: string;
  slug: string;
  description: {
    raw: string;
    rendered: string;
  };
  link: string;
  status: 'public' | 'private' | 'hidden';
  date_created: string;
  date_created_gmt: string;
  created_since?: string;
  enable_forum?: boolean;
  parent_id?: number;
  types?: string[];
  total_member_count: number;
  last_activity?: string;
  last_activity_diff?: string;
  last_activity_gmt?: string;
  avatar_urls?: {
    full: string;
    thumb: string;
  };
  cover_image?: string;
  admins?: Array<{
    user_id: number;
    is_admin: boolean;
    is_mod: boolean;
    date_modified: string;
  }>;
}

/**
 * Groups response with pagination
 */
export interface GroupsResponse {
  groups: BPGroup[];
  total: number;
  pages: number;
}

// ============================================
// BuddyPress Friends Types
// ============================================

/**
 * BuddyPress friendship relationship
 * Represents a connection between two users
 */
export interface BPFriendship {
  id: number;
  initiator_id: number;
  friend_id: number;
  is_confirmed: boolean;
  date_created: string;
  date_created_gmt?: string;
}

/**
 * Friend with complete user details
 * Combines friendship data with member profile data
 */
export interface FriendWithDetails extends BPMember {
  friendship_id: number;
  friendship_date: string;
  friendship_date_gmt?: string;
}

/**
 * Friends list response with pagination
 */
export interface FriendsListResponse {
  friends: FriendWithDetails[];
  total: number;
  pages: number;
}

// ============================================
// Authentication Types
// ============================================

/**
 * User profile data stored in auth context
 */
export interface UserProfile {
  user_id?: number;
  user_email: string;
  user_display_name: string;
}

/**
 * Authentication context state
 */
export interface AuthContextState {
  token: string | null;
  userId: number | null;
  profile: UserProfile | null;
  isMember: boolean | null;
  refreshMembership: () => Promise<void>;
  setAuth: (payload: JWTPayload) => Promise<void>;
  clearAuth: () => Promise<void>;
  ready: boolean;
  checkingMembership: boolean;
  lastMembershipCheckAt?: number;
}

// ============================================
// Navigation Types
// ============================================

/**
 * Tab screen identifiers
 */
export type TabScreen = 'index' | 'resources' | 'networking' | 'messages' | 'profile';

/**
 * Root stack screen identifiers
 */
export type RootScreen = 
  | 'index'
  | '(tabs)'
  | 'sign-in'
  | 'notification'
  | '(auth)/membership-levels';

/**
 * Tab navigation item configuration
 */
export interface TabNavItem {
  name: TabScreen;
  title: string;
  icon: string;
  iconOutline: string;
}

/**
 * Profile menu item configuration
 */
export interface ProfileMenuItem {
  label: string;
  href: string;
  icon: string;
}

// ============================================
// Component Props Types
// ============================================

/**
 * Props for screens that require authentication
 */
export interface AuthenticatedScreenProps {
  token: string;
  profile: UserProfile;
}

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// ============================================
// API Error Types
// ============================================

/**
 * Custom API error class
 */
export interface ApiErrorData {
  message: string;
  status: number;
  name: 'ApiError';
}

// ============================================
// Utility Types
// ============================================

/**
 * Async state for data fetching
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  perPage: number;
  total: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// ============================================
// React Query Types
// ============================================

/**
 * Query configuration options
 */
export interface QueryConfig {
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  retry?: number | boolean;
  enabled?: boolean;
}

/**
 * Mutation configuration options
 */
export interface MutationConfig {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  retry?: number | boolean;
}

/**
 * Query key types for type safety
 */
export type AuthQueryKey = ['auth', 'me'] | ['auth', 'membership'];
export type PostsQueryKey = 
  | ['posts']
  | ['posts', 'list', number]
  | ['posts', 'detail', number]
  | ['posts', 'category', string, number]
  | ['posts', 'tag', string, number];
export type MembershipQueryKey = 
  | ['membership', 'levels']
  | ['membership', 'status'];
export type ProfileQueryKey =
  | ['profile', 'member', number]
  | ['profile', 'me']
  | ['profile', 'avatar', number]
  | ['profile', 'cover', number]
  | ['profile', 'xprofile', number, number];

export type FriendsQueryKey =
  | ['friends', 'list', number]
  | ['friends', 'relationships', number]
  | ['friends', 'count', number];

export type ActivityQueryKey =
  | ['activity', 'feed', string]
  | ['activity', 'user', number]
  | ['activity', 'detail', number];

export type QueryKey = AuthQueryKey | PostsQueryKey | MembershipQueryKey | ProfileQueryKey | FriendsQueryKey | ActivityQueryKey;
