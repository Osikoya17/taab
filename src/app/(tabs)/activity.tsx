import { useRouter, useScrollToTop } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, View } from 'react-native';

import { ActivityRow } from '@/components/activity/ActivityRow';
import { AppHeader } from '@/components/ui/AppHeader';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { isMoneyEvent } from '@/features/activity/describe';
import { useActivityFeed } from '@/features/activity/queries';
import { toTimelineSections } from '@/features/activity/timeline';
import { useAuthSession } from '@/features/auth/auth-context';
import { FEATURES, FREE_LIMITS } from '@/features/billing/products';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import type { ActivityEvent } from '@/types/models';

export default function ExpensesScreen() {
  const router = useRouter();
  const { user } = useAuthSession();
  const feed = useActivityFeed();
  const bottomInset = useBottomInset(true);
  const listRef = useRef<SectionList<ActivityEvent>>(null);
  useScrollToTop(listRef);

  // Joins, new taabs and reminders are context, not money: keep them out of Expenses.
  const events = (feed.data?.pages.flatMap((p) => p.items) ?? []).filter(isMoneyEvent);
  const sections = toTimelineSections(events);
  const historyLimited = feed.data?.pages[feed.data.pages.length - 1]?.historyLimited ?? false;

  return (
    <Screen
      scroll={false}
      header={
        <>
          <AppHeader large title="Expenses" />
          <OfflineBanner />
        </>
      }>
      {feed.isPending ? (
        <View className="px-5">
          <LoadingSkeleton rows={6} />
        </View>
      ) : feed.isError && !feed.data ? (
        <ErrorState title="Couldn’t load your expenses." onRetry={() => feed.refetch()} retrying={feed.isRefetching} />
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text variant="label" tone="muted" className="bg-canvas pb-1 pt-6" accessibilityRole="header">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ActivityRow event={item} meId={user?.id ?? ''} onPress={(e) => router.push(`/expense/${e.expenseId}`)} />
          )}
          ItemSeparatorComponent={() => <Divider inset={52} />}
          ListEmptyComponent={<EmptyState illustration="pulse" title="No expenses yet." description="Bills and payments from all your taabs will show up here." />}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator className="py-6" />
            ) : historyLimited ? (
              <PressableScale
                onPress={() => router.push({ pathname: '/subscription', params: { feature: FEATURES.extendedHistory } })}
                accessibilityLabel="See full history with taab+"
                className="mt-6 rounded-card border border-line bg-surface px-4 py-4">
                <Text variant="bodyStrong">Looking for something older?</Text>
                <Text variant="caption" tone="muted" className="mt-0.5">
                  Free shows the last {FREE_LIMITS.historyMonths} months. taab+ keeps your full history in view.
                </Text>
              </PressableScale>
            ) : null
          }
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => feed.refetch()} />}
        />
      )}
    </Screen>
  );
}
