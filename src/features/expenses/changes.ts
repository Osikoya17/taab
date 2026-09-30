import type { Expense, ExpenseChange } from '@/types/models';

type People = { userId: string; amount: number }[];

function samePeople(a: People, b: People) {
  if (a.length !== b.length) return false;
  const amounts = new Map(a.map((p) => [p.userId, p.amount]));
  return b.every((p) => amounts.get(p.userId) === p.amount);
}

/** The calendar day, so re-saving the same date at a different time isn't a change. */
function day(iso: string) {
  return iso.slice(0, 10);
}

/**
 * What an edit changed, in the order people care about: the money first.
 * Returns an empty list when nothing meaningful changed.
 */
export function diffExpense(before: Expense, after: Expense): ExpenseChange[] {
  const changes: ExpenseChange[] = [];
  if (before.title !== after.title) changes.push({ field: 'title', from: before.title, to: after.title });
  if (before.amount !== after.amount) changes.push({ field: 'amount', from: before.amount, to: after.amount });
  if (!samePeople(before.paidBy, after.paidBy)) changes.push({ field: 'paidBy', from: before.paidBy, to: after.paidBy });
  if (!samePeople(before.splitBetween, after.splitBetween) || before.splitMethod !== after.splitMethod) {
    changes.push({ field: 'split', from: before.splitBetween, to: after.splitBetween, fromMethod: before.splitMethod, toMethod: after.splitMethod });
  }
  if (day(before.date) !== day(after.date)) changes.push({ field: 'date', from: before.date, to: after.date });
  if ((before.category ?? undefined) !== (after.category ?? undefined)) changes.push({ field: 'category', from: before.category, to: after.category });
  if ((before.notes || undefined) !== (after.notes || undefined)) changes.push({ field: 'notes', from: before.notes || undefined, to: after.notes || undefined });
  if (before.receiptUrl !== after.receiptUrl) {
    changes.push({ field: 'receipt', change: !before.receiptUrl ? 'added' : !after.receiptUrl ? 'removed' : 'replaced' });
  }
  return changes;
}
