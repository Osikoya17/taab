import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { activityService } from '@/services/activity.service';

export function useActivityFeed(groupId?: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.activity(groupId),
    queryFn: ({ pageParam }) => activityService.listActivity({ before: pageParam, groupId }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
