import { useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { TransferCard } from '@/components/settlements/TransferCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Screen } from '@/components/ui/Screen';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useGroup } from '@/features/groups/queries';
import { useSettleSuggestions } from '@/features/settlements/queries';
import type { SettleSuggestion } from '@/services/settlements.service';

function recordParams(s: SettleSuggestion) {
  return { groupId: s.groupId, fromUserId: s.fromUserId, toUserId: s.toUserId, amount: String(s.amount) };
}

export default function SettleScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const router = useRouter();
  const suggestions = useSettleSuggestions(groupId);
  const group = useGroup(groupId);

  const youOwe = suggestions.data?.filter((s) => s.direction === 'you_owe') ?? [];
  const owedToYou = suggestions.data?.filter((s) => s.direction === 'owed_to_you') ?? [];

  return (
    <Screen
      header={
        <>
          <AppHeader back title="Settle up" />
          <OfflineBanner />
        </>
      }
      refreshControl={<RefreshControl refreshing={suggestions.isRefetching} onRefresh={() => suggestions.refetch()} />}>
      <Text variant="body" tone="muted" className="pt-2">
        {groupId && group.data ? `The simplest way to square up in ${group.data.group.name}.` : 'The fewest payments to get everyone square.'}
      </Text>

      {suggestions.isPending ? (
        <View className="mt-6 gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : suggestions.isError && !suggestions.data ? (
        <ErrorState title="Couldn’t work out your balances." onRetry={() => suggestions.refetch()} retrying={suggestions.isRefetching} />
      ) : youOwe.length === 0 && owedToYou.length === 0 ? (
        <EmptyState illustration="check" title="You’re all settled." description="Nothing to pay and nothing to chase. Nice." />
      ) : (
        <>
          {youOwe.length > 0 ? (
            <View className="mt-6">
              <Text variant="label" tone="muted" className="mb-2">
                You pay
              </Text>
              <View className="gap-3">
                {youOwe.map((s) => (
                  <TransferCard
                    key={`${s.groupId}-${s.toUserId}`}
                    suggestion={s}
                    showGroup={!groupId}
                    onRecord={() => router.push({ pathname: '/settle/record', params: recordParams(s) })}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {owedToYou.length > 0 ? (
            <View className="mt-7">
              <Text variant="label" tone="muted" className="mb-2">
                You get back
              </Text>
              <View className="gap-3">
                {owedToYou.map((s) => (
                  <TransferCard
                    key={`${s.groupId}-${s.fromUserId}`}
                    suggestion={s}
                    showGroup={!groupId}
                    onRecord={() => router.push({ pathname: '/settle/record', params: recordParams(s) })}
                    onRemind={() => router.push({ pathname: '/reminder/new', params: { groupId: s.groupId, userId: s.fromUserId } })}
                  />
                ))}
              </View>
            </View>
          ) : null}
          <Text variant="caption" tone="faint" className="mt-6 text-center">
            taab simplifies debts so fewer payments are needed. Your expense history stays exactly as it was.
          </Text>
        </>
      )}
    </Screen>
  );
}
