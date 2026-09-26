import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { notificationsService, NOTIFICATION_CATEGORY_LABELS } from '@/services/notifications.service';
import type { NotificationCategory } from '@/types/models';

import { getNotifications } from './module';

/**
 * Push notification plumbing. Payloads from the backend carry a `category`
 * (used for the Android channel) and an optional in-app `url` to open.
 *
 * Example payload:
 *   { title: 'Gbayin added an expense', body: 'Dinner • ₦48,000\nYour share is ₦12,000.',
 *     data: { url: '/expense/e_123', category: 'new_expense' }, channelId: 'new_expense' }
 */
getNotifications()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannels() {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS !== 'android') return;
  const categories = Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[];
  await Promise.all(
    categories.map((id) =>
      Notifications.setNotificationChannelAsync(id, {
        name: NOTIFICATION_CATEGORY_LABELS[id].title,
        description: NOTIFICATION_CATEGORY_LABELS[id].detail,
        importance: id === 'group_activity' ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.DEFAULT,
        lightColor: '#111111',
      }),
    ),
  );
}

/** 'granted' | 'denied' | 'undetermined', or 'unsupported' where push can't run (Android Expo Go). */
export async function getPushPermission(): Promise<string> {
  const Notifications = getNotifications();
  if (!Notifications) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Asks for permission (channels first so Android 13 shows its prompt) and
 * registers the Expo push token with the backend. Returns whether push is on.
 */
export async function enablePushNotifications(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  await ensureAndroidChannels();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return false;

  // Remote push needs a real device and a development/production build.
  if (!Device.isDevice) return true;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return true;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await notificationsService.registerPushToken(data);
  } catch {
    // Token registration can fail on simulators or without network; the inbox still works.
  }
  return true;
}
