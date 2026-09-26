import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications throws as soon as it is imported inside Expo Go on
 * Android (remote push was removed from Expo Go in SDK 53). Load it lazily,
 * and only where it works, so the rest of the app runs in Expo Go.
 * Development and production builds get full push support.
 */
export const notificationsSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

let cached: NotificationsModule | null | undefined;

export function getNotifications(): NotificationsModule | null {
  if (cached === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = notificationsSupported ? (require('expo-notifications') as NotificationsModule) : null;
  }
  return cached;
}
