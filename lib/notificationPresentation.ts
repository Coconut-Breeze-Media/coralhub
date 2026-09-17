import type { BPNotification } from '../types';

export type NotificationIconName =
  | 'at-outline'
  | 'chatbubble-ellipses-outline'
  | 'heart-outline'
  | 'people-outline'
  | 'person-add-outline'
  | 'checkmark-circle-outline'
  | 'notifications-outline';

export interface PresentedNotification {
  title: string;
  description: string;
  icon: NotificationIconName;
  route: string | null;
}

const FRIEND_REQUEST_ACTIONS = new Set([
  'friendship_request',
  'friends_friendship_request',
]);

const GROUP_INVITE_ACTIONS = new Set(['group_invite', 'groups_invite']);
const GROUP_REQUEST_ACTIONS = new Set([
  'membership_request',
  'groups_membership_request',
  'new_membership_request',
]);

export function getMirroredNotificationKind(
  notification: BPNotification
): 'friend_request' | 'group_invite' | 'group_request' | null {
  if (FRIEND_REQUEST_ACTIONS.has(notification.action)) return 'friend_request';
  if (GROUP_INVITE_ACTIONS.has(notification.action)) return 'group_invite';
  if (GROUP_REQUEST_ACTIONS.has(notification.action)) return 'group_request';
  return null;
}

export function isMessageNotification(notification: BPNotification): boolean {
  return notification.component === 'messages';
}

export function getNotificationActorId(notification: BPNotification): number | null {
  const action = notification.action;
  const isActivityInteraction =
    action.includes('at_mention') ||
    action.includes('mention') ||
    action.includes('reply') ||
    action.includes('comment') ||
    action === 'activity_favorited' ||
    action.includes('favorite') ||
    action.includes('like');

  if (!isActivityInteraction) return null;

  const actorId = Number(notification.secondary_item_id);
  return actorId > 0 ? actorId : null;
}

export function presentBuddyPressNotification(
  notification: BPNotification,
  actorName?: string | null
): PresentedNotification {
  const { action, component, item_id: itemId } = notification;
  const actor = actorName?.trim() || 'Someone';

  if (action.includes('at_mention') || action.includes('mention')) {
    return {
      title: 'You were mentioned',
      description: `${actor} mentioned you in a post or comment.`,
      icon: 'at-outline',
      route: itemId ? `/post-detail?id=${itemId}&comments=1` : null,
    };
  }

  if (action.includes('reply') || action.includes('comment')) {
    return {
      title: action.includes('reply') ? 'New reply' : 'New comment',
      description: action.includes('reply')
        ? `${actor} replied to your post or comment.`
        : `${actor} commented on your post.`,
      icon: 'chatbubble-ellipses-outline',
      route: itemId ? `/post-detail?id=${itemId}&comments=1` : null,
    };
  }

  if (action === 'activity_favorited' || action.includes('favorite') || action.includes('like')) {
    return {
      title: 'New reaction',
      description: `${actor} liked your post.`,
      icon: 'heart-outline',
      route: itemId ? `/post-detail?id=${itemId}` : null,
    };
  }

  if (action.includes('friendship_accepted')) {
    return {
      title: 'Connection accepted',
      description: 'Your connection request was accepted.',
      icon: 'checkmark-circle-outline',
      route: '/profile/connections',
    };
  }

  if (action.includes('membership_request_accepted')) {
    return {
      title: 'Group request accepted',
      description: 'Your request to join a group was accepted.',
      icon: 'checkmark-circle-outline',
      route: itemId ? `/group-detail?id=${itemId}` : '/(tabs)/index?tab=groups',
    };
  }

  if (action.includes('membership_request_rejected')) {
    return {
      title: 'Group request declined',
      description: 'A group administrator declined your membership request.',
      icon: 'people-outline',
      route: itemId ? `/group-detail?id=${itemId}` : '/(tabs)/index?tab=groups',
    };
  }

  if (component === 'groups') {
    return {
      title: 'Group update',
      description: 'There is an update in one of your groups.',
      icon: 'people-outline',
      route: itemId ? `/group-detail?id=${itemId}` : '/(tabs)/index?tab=groups',
    };
  }

  if (component === 'friends') {
    return {
      title: 'Connection update',
      description: 'There is an update to one of your connections.',
      icon: 'person-add-outline',
      route: '/profile/connections',
    };
  }

  return {
    title: 'New notification',
    description: 'You have a new update in CoralHub.',
    icon: 'notifications-outline',
    route: null,
  };
}
