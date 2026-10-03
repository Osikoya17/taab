import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRightLeft, MoreHorizontal, Plus, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, Share, View } from 'react-native';

import { ExpenseRow, SettlementRow } from '@/components/expenses/ExpenseRow';
import { GroupMenu } from '@/components/groups/GroupMenu';
import { MemberBalances } from '@/components/groups/MemberBalances';
import { TripPackCard } from '@/components/groups/TripPackCard';
import { PendingBalanceNote } from '@/components/settlements/PendingBalanceNote';
import { ActionTile } from '@/components/ui/ActionTile';
import { AppHeader } from '@/components/ui/AppHeader';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { BalanceBadge } from '@/components/ui/BalanceBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Screen } from '@/components/ui/Screen';
import { BalanceSkeleton, LoadingSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useAuthSession } from '@/features/auth/auth-context';
import { EXTRAS_ENABLED } from '@/features/billing/products';
import { useDisplayCurrency } from '@/features/currency/display';
import { useGroupExpenses, useGroupSettlements } from '@/features/expenses/queries';
import { groupSummaryText } from '@/features/groups/export';
import { useGroup, useLeaveGroup } from '@/features/groups/queries';
import { useDownloadGroupReport } from '@/features/reports/use-download-report';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { isServiceError } from '@/services/api/errors';
import type { ExpenseListItem } from '@/services/expenses.service';
import { toast } from '@/store/toast.store';
import type { Settlement } from '@/types/models';
import { useGoBack } from '@/hooks/use-go-back';

type FeedItem = { kind: 'expense'; at: string; item: ExpenseListItem } | { kind: 'payment'; at: string; item: Settlement };

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const { download: downloadReport } = useDownloadGroupReport();
  const { user } = useAuthSession();
  const meId = user?.id ?? '';
  const group = useGroup(id);
  const expenses = useGroupExpenses(id);
  const settlements = useGroupSettlements(id);
  const leave = useLeaveGroup();
  const bottomInset = useBottomInset(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { display, convert } = useDisplayCurrency();

  const detail = group.data;
  const feed: FeedItem[] = [
    ...(expenses.data ?? []).map((item) => ({ kind: 'expense' as const, at: item.expense.date, item })),
    ...(settlements.data ?? []).map((item) => ({ kind: 'payment' as const, at: item.createdAt, item })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  /** Basic export is free: a plain-text summary anyone in the taab can share. */
  function exportSummary() {
    if (detail) Share.share({ message: groupSummaryText(detail, expenses.data ?? []) }).catch(() => undefined);
  }

  async function leaveGroup() {
    try {
      await leave.mutateAsync(id);
      setConfirmLeave(false);
      toast.show(`You left ${detail?.group.name ?? 'the taab'}`);
      goBack('/groups');
    } catch (error) {
      setConfirmLeave(false);
      toast.error(
        isServiceError(error) && error.code === 'validation' ? 'Settle up before leaving' : 'Couldn’t leave right now',
        isServiceError(error) && error.code === 'validation' ? 'You can leave once your balance is zero and no payments are waiting to be confirmed.' : 'Check your connection and try again.',
      );
    }
  }

  if (group.isError && !detail) {
    return (
      <Screen header={<AppHeader back />}>
        <ErrorState title="Couldn’t load this taab." onRetry={() => group.refetch()} retrying={group.isRefetching} />
      </Screen>
    );
  }

  const header = detail ? (
    <View className="pb-2">
      <View className="flex-row items-center gap-3">
        <AvatarStack people={detail.group.members.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }))} size={32} max={5} />
        <Text variant="caption" tone="muted">
          {detail.group.members.length} people
        </Text>
      </View>

      <View className="mt-6">
        <Text variant="label" tone="muted">
          Total outstanding
        </Text>
        <Money amount={detail.outstanding} currency={detail.group.currency} size="large" animated />
        {convert(0, detail.group.currency).converted ? (
          <Text variant="caption" tone="faint" className="mt-0.5">
            Shown in {display} at today’s rates · this taab uses {detail.group.currency}
          </Text>
        ) : null}
        <View className="mt-2">
          <BalanceBadge amount={detail.myBalance} currency={detail.group.currency} appearance="pill" groupSettled={detail.isSettled} />
        </View>
        <View className="mt-2">
          <PendingBalanceNote paid={detail.myPendingPaid} received={detail.myPendingReceived} currency={detail.group.currency} />
        </View>
      </View>

      <View className="mt-6 flex-row gap-3">
        <ActionTile primary icon={Plus} label="Add" accessibilityLabel="Add expense" onPress={() => router.push({ pathname: '/expense/new', params: { groupId: id } })} />
        <ActionTile icon={ArrowRightLeft} label="Settle up" onPress={() => router.push({ pathname: '/settle', params: { groupId: id } })} />
        <ActionTile icon={UserPlus} label="Invite" onPress={() => router.push(`/group/${id}/invite`)} />
        <ActionTile icon={MoreHorizontal} label="More" onPress={() => setMenuOpen(true)} />
      </View>

      <Surface className="mt-6">
        <Text variant="label" tone="muted" className="mb-4">
          Balances
        </Text>
        <MemberBalances balances={detail.balances} currency={detail.group.currency} meId={meId} />
      </Surface>

      {EXTRAS_ENABLED ? (
        <View className="mt-4">
          <TripPackCard groupId={id} />
        </View>
      ) : null}

      <Text variant="subheading" className="mb-1 mt-8" accessibilityRole="header">
        Expenses
      </Text>
    </View>
  ) : (
    <View className="gap-6 pt-2">
      <BalanceSkeleton />
    </View>
  );

  return (
    <Screen
      scroll={false}
      header={
        <>
          <AppHeader back title={detail?.group.name ?? ''} right={detail ? <IconButton icon={MoreHorizontal} variant="plain" accessibilityLabel="Options" onPress={() => setMenuOpen(true)} /> : null} />
          <OfflineBanner />
        </>
      }>
      <FlatList
        data={detail ? feed : []}
        keyExtractor={(f) => (f.kind === 'expense' ? `e-${f.item.expense.id}` : `p-${f.item.id}`)}
        ListHeaderComponent={header}
        renderItem={({ item: f }) =>
          detail ? (
            f.kind === 'expense' ? (
              <ExpenseRow item={f.item} group={detail.group} meId={meId} onPress={() => router.push(`/expense/${f.item.expense.id}`)} />
            ) : (
              <SettlementRow settlement={f.item} group={detail.group} meId={meId} />
            )
          ) : null
        }
        ItemSeparatorComponent={() => <Divider inset={56} />}
        ListEmptyComponent={
          !detail || expenses.isPending ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <EmptyState
              compact
              illustration="receipt"
              title="No expenses yet"
              description="Add the first bill and taab will work out everyone’s share."
              actionLabel="Add expense"
              onAction={() => router.push({ pathname: '/expense/new', params: { groupId: id } })}
            />
          )
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={group.isRefetching}
            onRefresh={() => {
              group.refetch();
              expenses.refetch();
              settlements.refetch();
            }}
          />
        }
      />

      {detail ? (
        <GroupMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          groupName={detail.group.name}
          onInvite={() => router.push(`/group/${id}/invite`)}
          onRecurring={() => router.push(`/group/${id}/recurring`)}
          onPayout={() => router.push({ pathname: '/settings/payout', params: { groupId: id } })}
          onExport={exportSummary}
          onReport={() => downloadReport(id)}
          onLeave={() => setConfirmLeave(true)}
        />
      ) : null}

      <BottomSheet
        visible={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={`Leave ${detail?.group.name ?? 'this taab'}?`}
        description="You can leave once you’re settled. You’ll stop seeing this taab, and repeating bills that include you will stop for the group.">
        <View className="gap-2">
          <Button label="Leave taab" variant="danger" onPress={leaveGroup} loading={leave.isPending} />
          <Button label="Stay" variant="ghost" onPress={() => setConfirmLeave(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
