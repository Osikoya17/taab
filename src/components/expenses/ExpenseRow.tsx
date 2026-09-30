import { ArrowRightLeft, Clock } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { categoryMeta } from '@/features/expenses/categories';
import { useRespondToSettlement } from '@/features/settlements/queries';
import { haptics } from '@/lib/haptics';
import type { ExpenseListItem } from '@/services/expenses.service';
import { toast } from '@/store/toast.store';
import type { Group, Settlement } from '@/types/models';
import { dayLabel } from '@/utils/dates';
import { useDisplayCurrency } from '@/features/currency/display';

function nameOf(group: Group, userId: string, meId: string) {
  if (userId === meId) return 'You';
  return group.members.find((m) => m.userId === userId)?.name ?? 'Someone';
}

/** "Dinner · Yesterday · You paid ₦48,000 — Your share ₦12,000" */
export function ExpenseRow({ item, group, meId, onPress }: { item: ExpenseListItem; group: Group; meId: string; onPress: () => void }) {
  const colors = useColors();
  const { expense, myShare, status } = item;
  const { format } = useDisplayCurrency();
  const Icon = categoryMeta(expense.category).icon;
  const payers = expense.paidBy.filter((p) => p.amount > 0);
  const paidCopy =
    payers.length === 1
      ? `${nameOf(group, payers[0].userId, meId)} paid ${format(expense.amount, expense.currency)}`
      : `${payers.length} people paid ${format(expense.amount, expense.currency)}`;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${expense.title}, ${dayLabel(expense.date)}, ${paidCopy}, your share ${format(myShare, expense.currency)}`}
      pressedScale={0.99}
      className="flex-row items-center gap-3 py-3">
      <View className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface">
        <Icon size={19} color={colors.ink} strokeWidth={1.8} />
      </View>
      <View className="flex-1">
        <Text variant="bodyStrong" numberOfLines={1}>
          {expense.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1} className="mt-0.5">
          {dayLabel(expense.date)} · {paidCopy}
        </Text>
      </View>
      <View className="items-end">
        {myShare > 0 ? (
          <>
            <Text variant="micro" tone="faint">
              Your share
            </Text>
            <Money amount={myShare} currency={expense.currency} size="small" />
          </>
        ) : (
          <Text variant="caption" tone="faint">
            Not involved
          </Text>
        )}
        {status === 'settled' ? (
          <Text variant="micro" tone="positive" className="mt-0.5">
            Settled
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** Payments appear inline in the group feed so the story reads in order. */
export function SettlementRow({ settlement, group, meId }: { settlement: Settlement; group: Group; meId: string }) {
  const colors = useColors();
  const { format } = useDisplayCurrency();
  const respond = useRespondToSettlement();
  const from = nameOf(group, settlement.fromUserId, meId);
  const to = settlement.toUserId === meId ? 'you' : nameOf(group, settlement.toUserId, meId);
  const receiver = nameOf(group, settlement.toUserId, meId);
  const status = settlement.status ?? 'confirmed';
  const needsMe = status === 'pending' && settlement.toUserId === meId;
  const headline = status === 'confirmed' ? `${from} paid ${to}` : `${from} ${from === 'You' ? 'say' : 'says'} ${from === 'You' ? 'you' : 'they'} paid ${to}`;
  const statusCopy = status === 'confirmed'
    ? 'Payment'
    : status === 'declined'
      ? `Not received · ${receiver === 'You' ? 'you said' : `${receiver} said`} it didn’t arrive`
      : needsMe ? 'Waiting for you to confirm' : `Waiting for ${receiver} to confirm`;
  const money = format(settlement.amount, settlement.currency);

  function answer(response: 'confirm' | 'decline') {
    respond.mutate(
      { settlementId: settlement.id, response },
      {
        onSuccess: () => {
          haptics.success();
          toast.show(response === 'confirm' ? 'Payment confirmed' : `We’ve told ${from} it didn’t arrive`);
        },
        onError: () => toast.error('Couldn’t save your answer', 'Check your connection and try again.'),
      },
    );
  }

  return (
    <View className="py-3">
      <View className="flex-row items-center gap-3" accessible accessibilityLabel={`${headline} ${money}. ${statusCopy}`}>
        <View className={status === 'pending' ? 'h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft' : 'h-11 w-11 items-center justify-center rounded-2xl bg-sunken'}>
          {status === 'pending' ? <Clock size={17} color={colors.ink} strokeWidth={1.8} /> : <ArrowRightLeft size={17} color={colors.muted} strokeWidth={1.8} />}
        </View>
        <View className="flex-1">
          <Text variant="bodyStrong" numberOfLines={1} className={status === 'declined' ? 'line-through' : undefined}>
            {headline}
          </Text>
          <Text variant="caption" tone="muted" className="mt-0.5" numberOfLines={2}>
            {dayLabel(settlement.createdAt)} · {statusCopy}
          </Text>
        </View>
        <Money amount={settlement.amount} currency={settlement.currency} size="small" tone="muted" />
      </View>
      {needsMe ? (
        <View className="mt-3 flex-row gap-2 pl-14">
          <Button label="Not received" size="md" variant="secondary" className="flex-1" disabled={respond.isPending} onPress={() => answer('decline')} />
          <Button label="Yes, I got it" size="md" className="flex-1" loading={respond.isPending} onPress={() => answer('confirm')} />
        </View>
      ) : null}
    </View>
  );
}
