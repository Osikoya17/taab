import { useMutation, useQuery } from '@tanstack/react-query';

import { invalidateLedger } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import { queryClient } from '@/lib/query-client';
import { remindersService } from '@/services/reminders.service';
import { settlementsService, type RecordSettlementInput, type SettlementResponse } from '@/services/settlements.service';

export function useSettleSuggestions(groupId?: string) {
  return useQuery({ queryKey: queryKeys.settle(groupId), queryFn: () => settlementsService.getSuggestions(groupId) });
}

/** The working behind a taab's simplified payments. */
export function useSettlementExplanation(groupId: string) {
  return useQuery({ queryKey: queryKeys.settleExplain(groupId), queryFn: () => settlementsService.explainGroup(groupId), enabled: !!groupId });
}

/** Payments waiting for a receiver to confirm them, across all your taabs. */
export function usePendingPayments() {
  return useQuery({ queryKey: queryKeys.pendingPayments, queryFn: () => settlementsService.listPending() });
}

export function useRespondToSettlement() {
  return useMutation({
    mutationFn: ({ settlementId, response }: { settlementId: string; response: SettlementResponse }) =>
      settlementsService.respondToSettlement(settlementId, response),
    onSuccess: () => invalidateLedger(),
  });
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
    mutationFn: (input: Parameters<typeof remindersService.sendReminder>[0]) => remindersService.sendReminder(input),
    onSuccess: (_reminder, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminder(input.groupId, input.toUserId) });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
