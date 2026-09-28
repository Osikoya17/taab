import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Share2, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Screen } from '@/components/ui/Screen';
import { BalanceSkeleton, LoadingSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useAuthSession } from '@/features/auth/auth-context';
import { categoryMeta } from '@/features/expenses/categories';
import { useDeleteExpense, useExpense } from '@/features/expenses/queries';
import { useReceiptImage } from '@/features/expenses/use-receipt-image';
import { useDisplayCurrency } from '@/features/currency/display';
import { formatRate } from '@/features/currency/rates';
import { colors } from '@/constants/theme';
import { basisPointsToPercentString } from '@/features/expenses/split';
import { haptics } from '@/lib/haptics';
import { captureEvent } from '@/lib/posthog';
import { isServiceError } from '@/services/api/errors';
import { toast } from '@/store/toast.store';
import type { Group } from '@/types/models';
import { dayLabel } from '@/utils/dates';
import { formatMoney } from '@/utils/money';
import { useGoBack } from '@/hooks/use-go-back';

const STATUS_COPY = { settled: 'Settled', partial: 'Partially settled', unsettled: 'Unsettled' } as const;
const METHOD_COPY = { equal: 'Split equally', exact: 'Exact amounts', percentage: 'By percentage', shares: 'By shares' } as const;

function PersonLine({ group, userId, meId, amount, currency, detail }: { group: Group; userId: string; meId: string; amount: number; currency: Group['currency']; detail?: string }) {
  const member = group.members.find((m) => m.userId === userId);
  const name = userId === meId ? 'You' : (member?.name ?? 'Someone');
  return (
    <View className="min-h-[52px] flex-row items-center gap-3 py-2">
      <Avatar name={member?.name ?? name} uri={member?.avatarUrl} seed={userId} size={34} />
      <View className="flex-1">
        <Text variant="bodyStrong">{name}</Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <Money amount={amount} currency={currency} size="body" />
    </View>
  );
}

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const { user } = useAuthSession();
  const meId = user?.id ?? '';
  const query = useExpense(id);
  const remove = useDeleteExpense();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const receiptImage = useReceiptImage(query.data?.expense.receiptUrl);
  const { format } = useDisplayCurrency();

  if (query.isError && !query.data) {
    return (
      <Screen header={<AppHeader back />}>
        <ErrorState title="Couldn’t load this expense." description="It may have been deleted, or you’re offline." onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <Screen header={<AppHeader back />}>
        <View className="gap-8 pt-6">
          <BalanceSkeleton />
          <LoadingSkeleton rows={4} />
        </View>
      </Screen>
    );
  }

  const { expense, group, status, myShare } = data;
  const Icon = categoryMeta(expense.category).icon;
  const nameOf = (userId: string) => (userId === meId ? 'You' : (group.members.find((m) => m.userId === userId)?.name ?? 'Someone'));

  function shareDetails() {
    const lines = [
      `${expense.title} — ${formatMoney(expense.amount, expense.currency)}`,
      `${dayLabel(expense.date)} · ${group.name}`,
      '',
      `Paid by ${expense.paidBy.map((p) => `${nameOf(p.userId)} (${formatMoney(p.amount, expense.currency)})`).join(', ')}`,
      ...expense.splitBetween.map((s) => `• ${nameOf(s.userId)}: ${formatMoney(s.amount, expense.currency)}`),
    ];
    Share.share({ message: lines.join('\n') }).catch(() => undefined);
  }

  async function confirmRemove() {
    try {
      await remove.mutateAsync(expense.id);
      captureEvent('expense_deleted', {
        ...(expense.category ? { category: expense.category } : {}),
        currency: expense.currency,
        split_method: expense.splitMethod,
        participant_count: expense.splitBetween.length,
      });
      haptics.success();
      setConfirmDelete(false);
      toast.show(`${expense.title} deleted`);
      goBack();
    } catch (error) {
      toast.error('Couldn’t delete that expense', isServiceError(error) && error.code === 'history_locked'
        ? 'This would change the balance of someone who has settled up and left. Ask them to rejoin first.'
        : 'Check your connection and try again.');
    }
  }

  function splitDetail(value?: number) {
    if (value === undefined) return undefined;
    if (expense.splitMethod === 'percentage') return `${basisPointsToPercentString(value)}%`;
    if (expense.splitMethod === 'shares') return `${value} ${value === 1 ? 'share' : 'shares'}`;
    return undefined;
  }

  return (
    <Screen
      header={
        <AppHeader
          back
          right={
            <View className="flex-row">
              <IconButton icon={Share2} variant="plain" accessibilityLabel="Share details" onPress={shareDetails} />
              <IconButton icon={Pencil} variant="plain" accessibilityLabel="Edit expense" onPress={() => router.push(`/expense/${expense.id}/edit`)} />
            </View>
          }
        />
      }>
      <View className="items-center pt-4">
        <View className="h-14 w-14 items-center justify-center rounded-[20px] border border-line bg-surface">
          <Icon size={24} color="#111111" strokeWidth={1.8} />
        </View>
        <Text variant="heading" className="mt-4 text-center">
          {expense.title}
        </Text>
        <View className="mt-1">
          <Money amount={expense.amount} currency={expense.currency} size="hero" />
        </View>
        <Text variant="body" tone="muted" className="mt-1">
          {dayLabel(expense.date)} • {group.name}
        </Text>
        {expense.original ? (
          <Text variant="caption" tone="faint" className="mt-1 text-center">
            Entered as {formatMoney(expense.original.amount, expense.original.currency)} · {formatRate(expense.original.rate, expense.original.currency, expense.currency)}
          </Text>
        ) : null}
        <View className="mt-3 flex-row items-center gap-2">
          <View className={status === 'settled' ? 'rounded-full bg-positive-soft px-3 py-1' : 'rounded-full bg-sunken px-3 py-1'}>
            <Text variant="micro" tone={status === 'settled' ? 'positive' : 'muted'}>
              {STATUS_COPY[status]}
            </Text>
          </View>
          {myShare > 0 ? (
            <Text variant="caption" tone="muted">
              Your share {format(myShare, expense.currency)}
            </Text>
          ) : null}
        </View>
      </View>

      <Text variant="label" tone="muted" className="mb-2 mt-8">
        Paid by
      </Text>
      <Surface padded={false} className="px-4">
        {expense.paidBy.map((p, i) => (
          <View key={p.userId}>
            {i > 0 ? <Divider inset={46} /> : null}
            <PersonLine group={group} userId={p.userId} meId={meId} amount={p.amount} currency={expense.currency} />
          </View>
        ))}
      </Surface>

      <View className="mb-2 mt-6 flex-row items-center justify-between">
        <Text variant="label" tone="muted">
          Split
        </Text>
        <Text variant="caption" tone="faint">
          {METHOD_COPY[expense.splitMethod]}
        </Text>
      </View>
      <Surface padded={false} className="px-4">
        {expense.splitBetween.map((s, i) => (
          <View key={s.userId}>
            {i > 0 ? <Divider inset={46} /> : null}
            <PersonLine group={group} userId={s.userId} meId={meId} amount={s.amount} currency={expense.currency} detail={splitDetail(s.value)} />
          </View>
        ))}
      </Surface>

      {expense.notes ? (
        <>
          <Text variant="label" tone="muted" className="mb-2 mt-6">
            Notes
          </Text>
          <Surface>
            <Text variant="body">{expense.notes}</Text>
          </Surface>
        </>
      ) : null}

      {expense.receiptUrl ? (
        <>
          <Text variant="label" tone="muted" className="mb-2 mt-6">
            Receipt
          </Text>
          <Image source={receiptImage ? { uri: receiptImage } : undefined} style={{ width: '100%', height: 280, borderRadius: 22, backgroundColor: colors.sunken }} contentFit="cover" accessibilityLabel="Receipt photo" />
        </>
      ) : null}

      <View className="mt-8 gap-2">
        <Button label="Edit expense" icon={Pencil} variant="secondary" onPress={() => router.push(`/expense/${expense.id}/edit`)} />
        <Button label="Delete expense" icon={Trash2} variant="ghost" onPress={() => setConfirmDelete(true)} />
      </View>

      <BottomSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${expense.title}?`}
        description="Everyone’s balances will update. This can’t be undone.">
        <View className="gap-2">
          <Button label="Delete expense" variant="danger" onPress={confirmRemove} loading={remove.isPending} />
          <Button label="Keep it" variant="ghost" onPress={() => setConfirmDelete(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
