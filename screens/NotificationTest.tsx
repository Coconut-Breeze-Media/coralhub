/**
 * Notification Test Screen
 * Screen for testing push notification functionality
 */

import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { 
  scheduleTestNotification, 
  cancelAllNotifications,
  setBadgeCount,
  clearBadgeCount,
  getBadgeCount
} from '../lib/notifications';
import { useState, useEffect } from 'react';

export default function NotificationTestScreen() {
  const { expoPushToken, notification } = useNotifications();
  const [lastNotification, setLastNotification] = useState<string>('None');
  const [badgeCount, setBadgeCountState] = useState<number>(0);

  useEffect(() => {
    if (notification) {
      const content = notification.notification.request.content;
      setLastNotification(`${content.title}: ${content.body}`);
    }
  }, [notification]);

  useEffect(() => {
    updateBadgeCount();
  }, []);

  const updateBadgeCount = async () => {
    const count = await getBadgeCount();
    setBadgeCountState(count);
  };

  const handleScheduleNotification = async () => {
    try {
      await scheduleTestNotification(
        'Test Notification',
        'This notification was scheduled from the app',
        2
      );
      Alert.alert('Success', 'Notification scheduled for 2 seconds from now');
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule notification');
      console.error(error);
    }
  };

  const handleCancelAll = async () => {
    try {
      await cancelAllNotifications();
      Alert.alert('Success', 'All scheduled notifications cancelled');
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel notifications');
    }
  };

  const handleIncreaseBadge = async () => {
    const newCount = badgeCount + 1;
    await setBadgeCount(newCount);
    setBadgeCountState(newCount);
  };

  const handleClearBadge = async () => {
    await clearBadgeCount();
    setBadgeCountState(0);
  };

  const handleCopyToken = () => {
    if (expoPushToken) {
      Alert.alert(
        'Push Token', 
        expoPushToken,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Token</Text>
        <Pressable onPress={handleCopyToken} style={styles.tokenContainer}>
          <Text style={styles.token} numberOfLines={3}>
            {expoPushToken || 'Loading...'}
          </Text>
          <Text style={styles.copyHint}>Tap to copy</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Notifications</Text>
        <Pressable style={styles.button} onPress={handleScheduleNotification}>
          <Text style={styles.buttonText}>Schedule Test Notification (2s)</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleCancelAll}>
          <Text style={styles.buttonText}>Cancel All Notifications</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badge Count: {badgeCount}</Text>
        <Pressable style={styles.button} onPress={handleIncreaseBadge}>
          <Text style={styles.buttonText}>Increase Badge Count</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleClearBadge}>
          <Text style={styles.buttonText}>Clear Badge</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Notification</Text>
        <Text style={styles.info}>{lastNotification}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <Text style={styles.instruction}>
          1. Copy your push token above{'\n'}
          2. Go to https://expo.dev/notifications{'\n'}
          3. Paste your token and send a test notification{'\n'}
          4. Or schedule a local test notification using the button above
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  tokenContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 6,
  },
  token: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#666',
  },
  copyHint: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});
