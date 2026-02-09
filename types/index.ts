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
  content: string;
  date: string;
  date_gmt: string;
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
export type TabScreen = 'index' | 'resources' | 'networking' | 'profile';

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

export type QueryKey = AuthQueryKey | PostsQueryKey | MembershipQueryKey | ProfileQueryKey | FriendsQueryKey;
