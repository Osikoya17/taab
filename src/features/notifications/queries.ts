import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationPreferences } from '@/types/models';

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: notificationsService.list });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read).length ?? 0;
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: queryKeys.notificationPreferences, queryFn: notificationsService.getPreferences });
}

export function useUpdateNotificationPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => notificationsService.updatePreferences(patch),
    // Optimistic: toggles should feel instant.
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: queryKeys.notificationPreferences });
      const previous = client.getQueryData<NotificationPreferences>(queryKeys.notificationPreferences);
      if (previous) client.setQueryData(queryKeys.notificationPreferences, { ...previous, ...patch });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) client.setQueryData(queryKeys.notificationPreferences, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notificationPreferences }),
  });
}
