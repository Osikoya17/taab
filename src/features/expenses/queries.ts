import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidateLedger } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import { expensesService, type ExpenseInput } from '@/services/expenses.service';
import { settlementsService } from '@/services/settlements.service';

export function useGroupExpenses(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.groupExpenses(groupId ?? ''),
    queryFn: () => expensesService.listGroupExpenses(groupId!),
    enabled: !!groupId,
  });
}

export function useGroupSettlements(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.groupSettlements(groupId ?? ''),
    queryFn: () => settlementsService.listGroupSettlements(groupId!),
    enabled: !!groupId,
  });
}

export function useExpense(expenseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.expense(expenseId ?? ''),
    queryFn: () => expensesService.getExpense(expenseId!),
    enabled: !!expenseId,
  });
}

/** Who created an expense and every change since. */
export function useExpenseHistory(expenseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.expenseHistory(expenseId ?? ''),
    queryFn: () => expensesService.getHistory(expenseId!),
    enabled: !!expenseId,
  });
}

export function useSaveExpense(expenseId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, repeat }: { input: ExpenseInput; repeat?: { frequency: 'weekly' | 'monthly'; autoCreate: boolean } }) =>
      expenseId ? expensesService.updateExpense(expenseId, input) : expensesService.createExpense(input, repeat),
    onSuccess: () => Promise.all([invalidateLedger(), client.invalidateQueries({ queryKey: ['recurring'] })]),
  });
}

export function useDeleteExpense() {
  return useMutation({
    mutationFn: (expenseId: string) => expensesService.deleteExpense(expenseId),
    onSuccess: () => invalidateLedger(),
  });
}
