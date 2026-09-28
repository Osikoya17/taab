import Constants from 'expo-constants';

import { notificationsService } from '@/services/notifications.service';
import { getNotifications } from './module';
import { enablePushNotifications, getPushPermission } from './push';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } } }));
jest.mock('./module', () => ({ getNotifications: jest.fn() }));
jest.mock('@/services/notifications.service', () => ({
  notificationsService: { registerPushToken: jest.fn() },
  NOTIFICATION_CATEGORY_LABELS: { new_expense: { title: 'New expenses', detail: 'New bill' } },
}));

const notifications = {
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(), setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { LOW: 2, DEFAULT: 3 },
};

beforeEach(() => {
  jest.resetAllMocks();
  Constants.expoConfig!.extra!.eas.projectId = 'test-project';
  jest.mocked(getNotifications).mockReturnValue(notifications as unknown as NonNullable<ReturnType<typeof getNotifications>>);
  notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExpoPushToken[test]' });
});

it('reports unsupported when the build has no push project', async () => {
  delete Constants.expoConfig!.extra!.eas.projectId;
  expect(await getPushPermission()).toBe('unsupported');
  expect(await enablePushNotifications()).toBe(false);
  expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
});
it('reports unsupported when the native module is unavailable', async () => {
  jest.mocked(getNotifications).mockReturnValue(null);
  expect(await getPushPermission()).toBe('unsupported');
  expect(await enablePushNotifications()).toBe(false);
});
it('does not register a device when permission is denied', async () => {
  notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
  expect(await enablePushNotifications()).toBe(false);
  expect(notificationsService.registerPushToken).not.toHaveBeenCalled();
});
it('succeeds only after storing the device token', async () => {
  expect(await enablePushNotifications()).toBe(true);
  expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project' });
  expect(notificationsService.registerPushToken).toHaveBeenCalledWith('ExpoPushToken[test]');
});
it('reports token acquisition failure', async () => {
  notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('offline'));
  expect(await enablePushNotifications()).toBe(false);
});
it('reports backend registration failure even with OS permission granted', async () => {
  jest.mocked(notificationsService.registerPushToken).mockRejectedValue(new Error('offline'));
  expect(await enablePushNotifications()).toBe(false);
});
