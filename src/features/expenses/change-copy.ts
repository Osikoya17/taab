import type { CurrencyCode, ExpenseChange, MinorUnits, SplitMethod } from '@/types/models';
import { shortDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { CATEGORY_LABELS } from './category-labels';

type CopyOptions = {
  currency: CurrencyCode;
  format?: (amount: MinorUnits, currency: CurrencyCode) => string;
  /** "You" for the viewer, the member's name otherwise. */
  nameOf: (userId: string) => string;
};

const METHOD_PHRASE: Record<SplitMethod, string> = {
  equal: 'split it equally',
  exact: 'switched to exact amounts',
  percentage: 'switched to percentages',
  shares: 'switched to shares',
};

const FIELD_NOUN: Record<ExpenseChange['field'], string> = {
  title: 'the name',
  amount: 'the amount',
  paidBy: 'who paid',
  split: 'the split',
  date: 'the date',
  category: 'the category',
  notes: 'the notes',
  receipt: 'the receipt',
};

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One change as a phrase to follow the person's name: "changed the amount from ₦8,000 to ₦12,000". */
export function describeChange(change: ExpenseChange, { currency, format = formatMoney, nameOf }: CopyOptions): string {
  switch (change.field) {
    case 'title':
      return `renamed it from “${change.from}” to “${change.to}”`;
    case 'amount':
      return `changed the amount from ${format(change.from, currency)} to ${format(change.to, currency)}`;
    case 'paidBy':
      return `changed who paid to ${joinNames(change.to.map((p) => nameOf(p.userId)))}`;
    case 'split': {
      const before = new Set(change.from.map((s) => s.userId));
      const after = new Set(change.to.map((s) => s.userId));
      const added = change.to.filter((s) => !before.has(s.userId)).map((s) => nameOf(s.userId));
      const removed = change.from.filter((s) => !after.has(s.userId)).map((s) => nameOf(s.userId));
      const parts = [
        ...(added.length ? [`added ${joinNames(added)} to the split`] : []),
        ...(removed.length ? [`took ${joinNames(removed)} off the split`] : []),
        ...(change.fromMethod !== change.toMethod ? [METHOD_PHRASE[change.toMethod]] : []),
      ];
      return parts.length ? parts.join(', ') : 'changed who owes what';
    }
    case 'date':
      return `moved the date from ${shortDate(change.from)} to ${shortDate(change.to)}`;
    case 'category':
      return change.to ? `changed the category to ${CATEGORY_LABELS[change.to]}` : 'removed the category';
    case 'notes':
      return !change.from ? 'added a note' : !change.to ? 'removed the note' : 'changed the note';
    case 'receipt':
      return change.change === 'added' ? 'added a receipt photo' : change.change === 'removed' ? 'removed the receipt photo' : 'replaced the receipt photo';
  }
}

/** A short summary for feeds: "Changed who paid and the date". */
export function summarizeChanges(changes: ExpenseChange[]): string | undefined {
  if (!changes.length) return undefined;
  const nouns = changes.map((c) => FIELD_NOUN[c.field]);
  const shown = nouns.length > 3 ? [...nouns.slice(0, 2), `${nouns.length - 2} more`] : nouns;
  return `Changed ${joinNames(shown)}`;
}
