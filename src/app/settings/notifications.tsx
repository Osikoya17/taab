import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/features/notifications/queries';
import { enablePushNotifications, getPushPermission } from '@/features/notifications/push';
import { isServiceError } from '@/services/api/errors';
import { NOTIFICATION_CATEGORY_LABELS, notificationsService } from '@/services/notifications.service';
import { usePreferences } from '@/store/preferences.store';
import { toast } from '@/store/toast.store';
import { ErrorState } from '@/components/ui/ErrorState';
import type { NotificationCategory } from '@/types/models';

const ORDER: NotificationCategory[] = ['new_expense', 'payment_received', 'settlement', 'reminder', 'member_joined', 'recurring_expense', 'group_activity'];

export default function NotificationSettingsScreen() {
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const markPrompted = usePreferences((s) => s.markNotificationPrompted);
  const [permission, setPermission] = useState<string | null>(null);
  const [registrationFailed, setRegistrationFailed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [testing, setTesting] = useState(false);

  /** Asks the server to push to this account's phones, to prove the whole chain works. */
  async function sendTest() {
    if (testing) return;
    setTesting(true);
    try {
      if (permission === 'granted' && !(await enablePushNotifications())) {
        toast.error('This phone couldn’t connect for notifications', 'Check your connection and try again.');
        return;
      }
      const { devices } = await notificationsService.sendTest();
      if (devices) toast.success('Test sent', `It should arrive on your phone within a minute. Sent to ${devices} ${devices === 1 ? 'device' : 'devices'}.`);
      else toast.error('No phone is connected yet', 'Tap “Turn on notifications” first, then try again.');
    } catch (error) {
      toast.error(isServiceError(error) && error.code === 'rate_limited' ? 'Wait a moment before sending another' : 'Couldn’t send the test', isServiceError(error) && error.code === 'rate_limited' ? undefined : 'Check your connection and try again.');
    } finally { setTesting(false); }
  }

  useEffect(() => {
    getPushPermission()
      .then(async (status) => {
        setPermission(status);
        if (status === 'granted') setRegistrationFailed(!await enablePushNotifications());
      })
      .catch(() => setPermission('undetermined'));
  }, []);

  async function turnOn() {
    if (registering) return;
    setRegistering(true);
    try {
      markPrompted();
      const granted = await enablePushNotifications();
      const status = await getPushPermission();
      setPermission(status);
      setRegistrationFailed(!granted && status === 'granted');
      if (!granted && status === 'denied') await Linking.openSettings();
      else if (!granted && status === 'granted') toast.error('Couldn’t connect notifications', 'Check your connection and try again. Your inbox still works.');
    } catch { toast.error('Couldn’t enable notifications', 'Please try again in device settings.'); }
    finally { setRegistering(false); }
  }

  return (
    <Screen header={<AppHeader back title="Notifications" />}>
      {permission === 'unsupported' ? (
        <Text variant="caption" tone="muted" className="mt-3">
          {Platform.OS === 'web'
            ? 'Push notifications come through the taab phone app. On the web, everything still appears in your notification inbox (the bell on Home).'
            : 'Push notifications don’t work in Expo Go. Install the taab app to get them. Your notification inbox still works.'}
        </Text>
      ) : permission !== null && (permission !== 'granted' || registrationFailed) ? (
        <Surface className="mt-2 gap-3">
          <View>
            <Text variant="bodyStrong">{registrationFailed ? 'Notifications couldn’t connect' : 'Push notifications are off'}</Text>
            <Text variant="caption" tone="muted" className="mt-0.5">
              {registrationFailed ? 'Check your connection and retry to finish setting up notifications.' : 'Turn them on to hear when someone adds an expense or pays you back.'}
            </Text>
          </View>
          <Button label={registrationFailed ? 'Retry setup' : permission === 'denied' ? 'Open settings' : 'Turn on notifications'} size="md" onPress={turnOn} loading={registering} />
        </Surface>
      ) : null}

      {permission === 'granted' && !registrationFailed ? (
        <Surface className="mt-2 gap-3">
          <View>
            <Text variant="bodyStrong">Notifications are on</Text>
            <Text variant="caption" tone="muted" className="mt-0.5">
              Not getting them? Send yourself a test to check this phone.
            </Text>
          </View>
          <Button label="Send a test notification" size="md" variant="secondary" onPress={sendTest} loading={testing} />
        </Surface>
      ) : null}

      <Text variant="label" tone="muted" className="mb-2 mt-6 px-1">
        Notify me about
      </Text>
      {prefs.data ? (
        <Surface padded={false}>
          {ORDER.map((category, i) => (
            <View key={category}>
              {i > 0 ? <Divider inset={16} /> : null}
              <ListRow
                title={NOTIFICATION_CATEGORY_LABELS[category].title}
                detail={NOTIFICATION_CATEGORY_LABELS[category].detail}
                trailing={
                  <Toggle
                    value={prefs.data[category]}
                    onValueChange={(v) => update.mutate({ [category]: v })}
                    accessibilityLabel={NOTIFICATION_CATEGORY_LABELS[category].title}
                  />
                }
              />
            </View>
          ))}
        </Surface>
      ) : prefs.isError ? <ErrorState title="Couldn’t load preferences." onRetry={() => prefs.refetch()} /> : (
        <LoadingSkeleton rows={4} />
      )}
      <Text variant="caption" tone="faint" className="mt-4 px-1">
        Reminders are limited to one per person per taab each day, so nobody gets spammed.
      </Text>
    </Screen>
  );
}
