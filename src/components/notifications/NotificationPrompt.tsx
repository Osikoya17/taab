import { ArrowRightLeft, BellRing, ReceiptText, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { useNotificationPrompt } from '@/features/notifications/prompt';
import type { NotificationPromptReason } from '@/features/notifications/prompt-rules';
import { enablePushNotifications, getPushPermission } from '@/features/notifications/push';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/store/preferences.store';
import { toast } from '@/store/toast.store';

const TITLES: Record<NotificationPromptReason, string> = {
  welcome: 'Stay in the loop',
  expense: 'Know when your friends add bills',
  payment: 'Know when your payment is confirmed',
};

const REASONS: { icon: LucideIcon; text: string }[] = [
  { icon: ReceiptText, text: 'Someone adds or changes a bill you’re in' },
  { icon: ArrowRightLeft, text: 'Someone says they paid you, so you can confirm it, or confirms your payment' },
  { icon: BellRing, text: 'Friendly reminders about what’s owed and bills that are due' },
];

/** Says what taab will notify about, then asks the phone for permission. */
export function NotificationPrompt() {
  const colors = useColors();
  const reason = useNotificationPrompt((s) => s.reason);
  const hide = useNotificationPrompt((s) => s.hide);
  const markPrompted = usePreferences((s) => s.markNotificationPrompted);
  const [busy, setBusy] = useState(false);

  async function turnOn() {
    setBusy(true);
    markPrompted();
    try {
      const on = await enablePushNotifications();
      hide();
      if (on) {
        haptics.success();
        toast.success('Notifications are on');
      } else if ((await getPushPermission()) === 'denied') {
        toast.show('Notifications are off', 'You can turn them on any time in Profile → Notifications.');
      } else {
        toast.error('Couldn’t finish setting up notifications', 'Your in-app inbox still works. Try again from Profile → Notifications.');
      }
    } catch {
      hide();
      toast.error('Couldn’t finish setting up notifications', 'Try again from Profile → Notifications.');
    } finally {
      setBusy(false);
    }
  }

  function notNow() {
    markPrompted();
    hide();
  }

  return (
    <BottomSheet visible={!!reason} onClose={notNow} title={reason ? TITLES[reason] : ''} description="taab can send you a notification when:">
      <View className="gap-3">
        {REASONS.map(({ icon: Icon, text }) => (
          <View key={text} className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-2xl bg-sunken">
              <Icon size={17} color={colors.ink} strokeWidth={1.8} />
            </View>
            <Text variant="body" className="flex-1">
              {text}
            </Text>
          </View>
        ))}
      </View>
      <View className="mt-6 gap-2">
        <Button label="Turn on notifications" onPress={turnOn} loading={busy} />
        <Button label="Not now" variant="ghost" onPress={notNow} disabled={busy} />
      </View>
      <Text variant="caption" tone="faint" className="mt-2 text-center">
        Change this any time in Profile → Notifications.
      </Text>
    </BottomSheet>
  );
}
