// constants/navigation.ts
/**
 * Navigation configuration and constants for CoralHub application
 */

import type { TabNavItem, ProfileMenuItem } from '../types';

// ============================================
// Tab Navigation Configuration
// ============================================

/**
 * Tab navigation items configuration
 * Defines the structure of the bottom tab navigator
 */
export const TAB_SCREENS: ReadonlyArray<TabNavItem> = [
  {
    name: 'index',
    title: 'Community',
    icon: 'home',
    iconOutline: 'home-outline',
  },
  {
    name: 'resources',
    title: 'Resources',
    icon: 'people',
    iconOutline: 'people-outline',
  },
  {
    name: 'networking',
    title: 'Networking',
    icon: 'book',
    iconOutline: 'book-outline',
  },
  {
    name: 'profile',
    title: 'Profile',
    icon: 'person-circle',
    iconOutline: 'person-circle-outline',
  },
] as const;

// ============================================
// Screen Options
// ============================================

/**
 * Default header options for all screens
 */
export const DEFAULT_HEADER_OPTIONS = {
  headerTitleAlign: 'center' as const,
  headerShadowVisible: false,
  headerBackVisible: false,
};

/**
 * Tab bar configuration
 */
export const TAB_BAR_OPTIONS = {
  activeTintColor: '#0077b6',
  inactiveTintColor: '#6b7280',
  showLabel: true,
  style: {
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
};

// ============================================
// Profile Menu Configuration
// ============================================

/**
 * Profile screen menu items
 * Defines the navigation options available in the profile screen
 */
export const PROFILE_MENU_ITEMS: ReadonlyArray<ProfileMenuItem> = [
  {
    label: 'Profile Settings',
    href: '/profile/settings',
    icon: 'person-circle-outline',
  },
  {
    label: 'Activity',
    href: '/profile/activity',
    icon: 'time-outline',
  },
  {
    label: 'Messages',
    href: '/profile/messages',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    label: 'Groups',
    href: '/profile/groups',
    icon: 'people-outline',
  },
  {
    label: 'Connections',
    href: '/profile/connections',
    icon: 'link-outline',
  },
  {
    label: 'Account Settings',
    href: '/profile/account-settings',
    icon: 'settings-outline',
  },
  {
    label: 'Account',
    href: '/profile/account',
    icon: 'card-outline',
  },
] as const;

// ============================================
// Route Paths
// ============================================

/**
 * Application route paths
 */
export const ROUTES = {
  // Root level
  WELCOME: '/',
  SIGN_IN: '/sign-in',
  NOTIFICATIONS: '/notification',
  
  // Auth
  MEMBERSHIP_LEVELS: '/(auth)/membership-levels',
  
  // Tabs
  TABS: '/(tabs)',
  COMMUNITY: '/(tabs)/index',
  RESOURCES: '/(tabs)/resources',
  NETWORKING: '/(tabs)/networking',
  PROFILE: '/(tabs)/profile',
  
  // Profile subroutes
  PROFILE_SETTINGS: '/profile/settings',
  PROFILE_ACTIVITY: '/profile/activity',
  PROFILE_MESSAGES: '/profile/messages',
  PROFILE_GROUPS: '/profile/groups',
  PROFILE_CONNECTIONS: '/profile/connections',
  PROFILE_ACCOUNT_SETTINGS: '/profile/account-settings',
  PROFILE_ACCOUNT: '/profile/account',
} as const;

// ============================================
// Screen Titles
// ============================================

/**
 * Screen title mappings
 */
export const SCREEN_TITLES = {
  WELCOME: 'Welcome',
  SIGN_IN: '',
  NOTIFICATIONS: 'Notifications',
  MEMBERSHIP_LEVELS: 'Choose a Plan',
  COMMUNITY: 'Community',
  RESOURCES: 'Resources',
  NETWORKING: 'Networking',
  PROFILE: 'Profile',
} as const;

// ============================================
// Type Exports
// ============================================

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = typeof ROUTES[RouteKey];
