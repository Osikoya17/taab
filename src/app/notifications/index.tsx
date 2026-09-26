import { useFocusEffect, useRouter } from 'expo-router';
import { Settings2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { LoadingSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useMarkAllRead, useNotifications } from '@/features/notifications/queries';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import type { AppNotification } from '@/types/models';
import { relativeTime } from '@/utils/dates';
import { cx } from '@/utils/cx';

function NotificationRow({ item, onPress }: { item: AppNotification; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} accessibilityLabel={`${item.title}. ${item.body}`} pressedScale={0.99} className="flex-row gap-3 py-3.5">
      <View className={cx('mt-2 h-2 w-2 rounded-full', item.read ? 'bg-transparent' : 'bg-ink')} />
      <View className="flex-1">
        <Text variant="bodyStrong">{item.title}</Text>
        <Text variant="body" tone="muted" className="mt-0.5">
          {item.body}
        </Text>
        <Text variant="caption" tone="faint" className="mt-1">
          {relativeTime(item.createdAt)}
        </Text>
      </View>
    </PressableScale>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const notifications = useNotifications();
  const markAllRead = useMarkAllRead();
  const bottomInset = useBottomInset(false);

  // Opening the inbox marks everything as seen, after a beat so dots are visible first.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => markAllRead.mutate(), 1200);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <Screen
      scroll={false}
      header={
        <AppHeader
          back
          title="Notifications"
          right={<IconButton icon={Settings2} variant="plain" accessibilityLabel="Notification settings" onPress={() => router.push('/settings/notifications')} />}
        />
      }>
      {notifications.isPending ? (
        <View className="px-5">
          <LoadingSkeleton rows={5} />
        </View>
      ) : notifications.isError && !notifications.data ? (
        <ErrorState title="Couldn’t load notifications." onRetry={() => notifications.refetch()} />
      ) : (
        <FlatList
          data={notifications.data}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              onPress={
                item.expenseId
                  ? () => router.push(`/expense/${item.expenseId}`)
                  : item.groupId
                    ? () => router.push(`/group/${item.groupId}`)
                    : undefined
              }
            />
          )}
          ItemSeparatorComponent={() => <Divider inset={20} />}
          ListEmptyComponent={<EmptyState illustration="bell" title="No notifications yet." description="New expenses, payments and reminders will appear here." />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset }}
          refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => notifications.refetch()} />}
        />
      )}
    </Screen>
  );
}
