import { useRouter } from 'expo-router';
import { ArrowRightLeft, Bell, Plus } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { ActivityRow } from '@/components/activity/ActivityRow';
import { GroupCard } from '@/components/groups/GroupCard';
import { BalanceHero } from '@/components/home/BalanceHero';
import { DueRecurringCard } from '@/components/home/DueRecurringCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BalanceSkeleton, CardSkeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import { useActivityFeed } from '@/features/activity/queries';
import { useAuthSession } from '@/features/auth/auth-context';
import { buildOverview } from '@/features/groups/overview';
import { useGroups } from '@/features/groups/queries';
import { useUnreadCount } from '@/features/notifications/queries';
import { useProfile } from '@/features/profile/queries';
import { emptyStateExample } from '@/features/profile/use-cases';
import { useDueRecurring } from '@/features/recurring/queries';
import { greeting } from '@/utils/dates';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthSession();
  const meId = user?.id ?? '';
  const { data: profile } = useProfile();
  const groups = useGroups();
  const activity = useActivityFeed();
  const due = useDueRecurring();
  const unread = useUnreadCount();

  const name = profile?.name?.split(' ')[0] ?? user?.firstName ?? '';
  const overview = groups.data ? buildOverview(groups.data, meId, profile?.defaultCurrency ?? DEFAULT_CURRENCY) : null;
  const recentEvents = activity.data?.pages[0]?.items.slice(0, 5) ?? [];
  const hasGroups = (groups.data?.length ?? 0) > 0;

  const header = (
    <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
      <View>
        <Text variant="label" tone="muted">
          {greeting()}
        </Text>
        <Text variant="heading">{name}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <IconButton icon={Bell} accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} badge={unread > 0} onPress={() => router.push('/notifications')} />
        <PressableScale onPress={() => router.push('/profile')} accessibilityLabel="Your profile" pressedScale={0.94}>
          <Avatar name={profile?.name ?? name} uri={profile?.avatarUrl ?? user?.imageUrl} seed={meId} size={44} />
        </PressableScale>
      </View>
    </View>
  );

  return (
    <Screen
      withTabBar
      header={
        <>
          {header}
          <OfflineBanner />
        </>
      }
      refreshControl={
        <RefreshControl
          refreshing={groups.isRefetching}
          onRefresh={() => {
            groups.refetch();
            activity.refetch();
          }}
        />
      }>
      {groups.isPending ? (
        <View className="gap-6 pt-4">
          <BalanceSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : groups.isError && !groups.data ? (
        <ErrorState title="Couldn’t load your taabs." onRetry={() => groups.refetch()} retrying={groups.isRefetching} />
      ) : !hasGroups ? (
        <EmptyState
          illustration="receipt"
          title="Nothing to split yet."
          description={`Create a taab with friends and add your first expense — like “${emptyStateExample(profile?.useCase)}”.`}
          actionLabel="Create a taab"
          onAction={() => router.push('/group/new')}
        />
      ) : (
        <>
          <View className="pt-4">{overview ? <BalanceHero overview={overview} /> : null}</View>

          <View className="mt-5 flex-row gap-3">
            <View className="flex-1">
              <Button label="Add expense" icon={Plus} onPress={() => router.push('/expense/new')} />
            </View>
            <View className="flex-1">
              <Button label="Settle up" icon={ArrowRightLeft} variant="secondary" onPress={() => router.push('/settle')} />
            </View>
          </View>

          {due.data && due.data.length > 0 ? (
            <View className="mt-5 gap-3">
              {due.data.map((rule) => (
                <DueRecurringCard key={rule.id} rule={rule} />
              ))}
            </View>
          ) : null}

          <View className="mt-9">
            <SectionHeader title="Recent taabs" actionLabel="See all" onAction={() => router.push('/groups')} />
            <View className="gap-3">
              {groups.data?.slice(0, 3).map((summary) => (
                <GroupCard key={summary.group.id} summary={summary} onPress={() => router.push(`/group/${summary.group.id}`)} />
              ))}
            </View>
          </View>

          <View className="mt-9">
            <SectionHeader title="Recent activity" actionLabel="See all" onAction={() => router.push('/activity')} />
            <Surface padded={false} className="px-4 py-1">
              {activity.isPending ? (
                <Text variant="caption" tone="muted" className="py-4">
                  Loading…
                </Text>
              ) : recentEvents.length === 0 ? (
                <Text variant="caption" tone="muted" className="py-4">
                  Quiet for now.
                </Text>
              ) : (
                recentEvents.map((event) => (
                  <ActivityRow key={event.id} event={event} meId={meId} onPress={(e) => router.push(`/expense/${e.expenseId}`)} />
                ))
              )}
            </Surface>
          </View>
        </>
      )}
    </Screen>
  );
}
