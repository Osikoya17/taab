import { useMutation, useQuery } from '@tanstack/react-query';

import { invalidateLedger } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import { queryClient } from '@/lib/query-client';
import { remindersService } from '@/services/reminders.service';
import { settlementsService, type RecordSettlementInput } from '@/services/settlements.service';

export function useSettleSuggestions(groupId?: string) {
  return useQuery({ queryKey: queryKeys.settle(groupId), queryFn: () => settlementsService.getSuggestions(groupId) });
}

export function useRecordSettlement() {
  return useMutation({
    mutationFn: (input: RecordSettlementInput) => settlementsService.recordSettlement(input),
    onSuccess: () => invalidateLedger(),
  });
}

export function useReminderStatus(groupId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reminder(groupId ?? '', userId ?? ''),
    queryFn: () => remindersService.getStatus(groupId!, userId!),
    enabled: !!groupId && !!userId,
  });
}

export function useSendReminder() {
  return useMutation({
    mutationFn: remindersService.sendReminder,
    onSuccess: (_reminder, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminder(input.groupId, input.toUserId) });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
