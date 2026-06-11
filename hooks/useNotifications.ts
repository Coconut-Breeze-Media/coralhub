/**
 * useNotifications Hook
 * React hook for managing push notifications in the app
 */

import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../lib/notifications';

export interface NotificationData {
  notification: Notifications.Notification;
  response?: Notifications.NotificationResponse;
}

/**
 * Custom hook for handling push notifications
 * @returns {Object} Notification state and push token
 */
export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<NotificationData | undefined>();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    
    // Register for push notifications and get token
    registerForPushNotificationsAsync()
      .then(token => {
        setExpoPushToken(token);
      })
      .catch(error => {
      });

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      setNotification({ notification });
    });

    // Listener for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      setNotification({
        notification: response.notification,
        response,
      });
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
}
