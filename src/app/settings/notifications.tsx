import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

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
import { NOTIFICATION_CATEGORY_LABELS } from '@/services/notifications.service';
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
      {permission === 'unsupported' ? <Text variant="caption" tone="muted" className="mt-3">Push notifications aren’t available in this version of taab. Your notification inbox still works.</Text> : permission !== null && (permission !== 'granted' || registrationFailed) ? (
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
