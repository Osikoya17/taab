import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/features/auth/auth-context';
import { invalidateLedger } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import { recurringService, type RecurringInput } from '@/services/recurring.service';

export function useRecurring(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recurring(groupId ?? ''),
    queryFn: () => recurringService.list(groupId!),
    enabled: !!groupId,
  });
}

/** Runs due recurring expenses; pending ones are surfaced on Home for confirmation. */
export function useDueRecurring() {
  const { isSignedIn } = useAuthSession();
  return useQuery({
    queryKey: queryKeys.recurringDue,
    queryFn: async () => {
      const result = await recurringService.processDue();
      if (result.created.length > 0) await invalidateLedger();
      return result.pending;
    },
    enabled: isSignedIn,
    staleTime: 5 * 60_000,
  });
}

export function useCreateRecurring() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RecurringInput) => recurringService.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useRemoveRecurring(groupId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringService.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useResolveDue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'skip' }) =>
      action === 'confirm' ? recurringService.confirmDue(id).then(() => undefined) : recurringService.skipDue(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['recurring'] });
      await invalidateLedger();
    },
  });
}
