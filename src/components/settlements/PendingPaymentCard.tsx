import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useDisplayCurrency } from '@/features/currency/display';
import { SETTLEMENT_METHODS } from '@/features/settlements/methods';
import { useRespondToSettlement } from '@/features/settlements/queries';
import { haptics } from '@/lib/haptics';
import type { PendingPayment } from '@/services/settlements.service';
import { toast } from '@/store/toast.store';
import { relativeTime } from '@/utils/dates';

/**
 * "Dami says they paid you ₦5,000 — did you get it?" Balances only move once
 * the person who received the money says yes.
 */
export function PendingPaymentCard({ pending }: { pending: PendingPayment }) {
  const respond = useRespondToSettlement();
  const { format } = useDisplayCurrency();
  const { settlement, fromName, groupName } = pending;
  const money = format(settlement.amount, settlement.currency);
  const how = SETTLEMENT_METHODS.find((m) => m.value === settlement.method)?.label;
  const meta = [groupName, how, relativeTime(settlement.createdAt)].filter(Boolean).join(' · ');

  function answer(response: 'confirm' | 'decline') {
    respond.mutate(
      { settlementId: settlement.id, response },
      {
        onSuccess: () => {
          haptics.success();
          if (response === 'confirm') toast.success('Payment confirmed', `${money} from ${fromName} now counts in ${groupName}.`);
          else toast.show(`We’ve told ${fromName} it didn’t arrive`);
        },
        onError: () => toast.error('Couldn’t save your answer', 'Check your connection and try again.'),
      },
    );
  }

  return (
    <Surface className="gap-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={fromName} seed={settlement.fromUserId} size={40} />
        <View className="flex-1">
          <Text variant="bodyStrong">
            {fromName} says they paid you {money}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
      {settlement.note ? (
        <Text variant="caption" tone="muted">
          “{settlement.note}”
        </Text>
      ) : null}
      <Text variant="caption" tone="faint">
        Balances update once you confirm.
      </Text>
      <View className="flex-row gap-2">
        <Button
          label="Not received"
          size="md"
          variant="secondary"
          className="flex-1"
          disabled={respond.isPending}
          onPress={() => answer('decline')}
          accessibilityHint={`Tells ${fromName} the payment hasn’t arrived`}
        />
        <Button label="Yes, I got it" size="md" className="flex-1" loading={respond.isPending} onPress={() => answer('confirm')} />
      </View>
    </Surface>
  );
}
