import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SheetHeader } from '@/components/ui/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormInput } from '@/components/ui/FormInput';
import { Money } from '@/components/ui/Money';
import { Screen } from '@/components/ui/Screen';
import { BalanceSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useGroup } from '@/features/groups/queries';
import { useReminderStatus, useSendReminder } from '@/features/settlements/queries';
import { haptics } from '@/lib/haptics';
import { isServiceError } from '@/services/api/errors';
import { toast } from '@/store/toast.store';
import { relativeTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';
import { useGoBack } from '@/hooks/use-go-back';

export default function ReminderScreen() {
  const { groupId, userId } = useLocalSearchParams<{ groupId: string; userId: string }>();
  const goBack = useGoBack();
  const group = useGroup(groupId);
  const status = useReminderStatus(groupId, userId);
  const send = useSendReminder();

  const detail = group.data;
  const member = detail?.group.members.find((m) => m.userId === userId);
  const owed = Math.max(0, -(detail?.balances.find((b) => b.userId === userId)?.amount ?? 0));
  const suggested = detail ? `Hey, just a reminder that ${formatMoney(owed, detail.group.currency)} is still outstanding on ${detail.group.name}.` : '';
  const [message, setMessage] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const text = message ?? suggested;

  if (!detail || !member) {
    return (
      <Screen safeTop={false} header={<SheetHeader title="Send reminder" onCancel={() => goBack(`/group/${groupId}`)} />}>
        {group.isError ? <ErrorState title="Couldn’t load this taab." onRetry={() => group.refetch()} /> : <BalanceSkeleton />}
      </Screen>
    );
  }

  const canSend = status.data?.canSend ?? false;
  const nextAllowed = status.data?.nextAllowedAt;

  async function submit() {
    try {
      await send.mutateAsync({ groupId, toUserId: userId, message: text });
      haptics.success();
      toast.success(`Reminder sent to ${member?.name}`);
      goBack(`/group/${groupId}`);
    } catch (error) {
      const code = isServiceError(error) ? error.code : undefined;
      toast.error(
        code === 'rate_limited' ? 'You’ve already nudged them today' : code === 'validation' ? `${member?.name} is all settled` : 'Couldn’t send that reminder',
        code === 'rate_limited' ? 'You can send another tomorrow.' : undefined,
      );
    }
  }

  return (
    <Screen
      keyboard
      safeTop={false}
      header={<SheetHeader title="Send reminder" onCancel={() => goBack(`/group/${groupId}`)} />}
      footer={
        <View className="gap-2">
          {!canSend && nextAllowed ? (
            <Text variant="caption" tone="muted" className="text-center">
              You reminded {member.name} recently. You can nudge again in {Math.max(1, Math.ceil((Date.parse(nextAllowed) - now) / 3_600_000))}h.
            </Text>
          ) : null}
          <Button label="Send reminder" onPress={submit} loading={send.isPending} disabled={!canSend || owed === 0 || text.trim().length === 0} />
        </View>
      }>
      <View className="items-center pt-4">
        <Avatar name={member.name} uri={member.avatarUrl} seed={member.userId} size={64} />
        <Text variant="body" tone="muted" className="mt-4">
          {member.name} owes you
        </Text>
        <Money amount={owed} currency={detail.group.currency} size="large" tone="positive" />
      </View>

      <View className="mt-8">
        <FormInput label="Message" value={text} onChangeText={setMessage} multiline maxLength={240} hint="Keep it friendly — taab sends one nudge per day at most." />
      </View>

      {status.data && status.data.history.length > 0 ? (
        <View className="mt-7">
          <Text variant="label" tone="muted" className="mb-2">
            Reminder history
          </Text>
          <Surface padded={false} className="px-4">
            {status.data.history.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <View className="py-3">
                  <Text variant="body" numberOfLines={2}>
                    {r.message}
                  </Text>
                  <Text variant="caption" tone="faint" className="mt-1">
                    {relativeTime(r.createdAt)} · {formatMoney(r.amount, r.currency)}
                  </Text>
                </View>
              </View>
            ))}
          </Surface>
        </View>
      ) : null}
    </Screen>
  );
}
