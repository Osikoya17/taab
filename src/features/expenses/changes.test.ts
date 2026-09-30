import type { Expense } from '@/types/models';

import { diffExpense } from './changes';

const base: Expense = {
  id: 'e1',
  groupId: 'g1',
  title: 'Fuel',
  amount: 800_000,
  currency: 'NGN',
  paidBy: [{ userId: 'dami', amount: 800_000 }],
  splitBetween: [
    { userId: 'dami', amount: 400_000 },
    { userId: 'tolu', amount: 400_000 },
  ],
  splitMethod: 'equal',
  date: '2026-09-28T12:00:00.000Z',
  createdBy: 'dami',
  createdAt: '2026-09-28T12:00:00.000Z',
  updatedAt: '2026-09-28T12:00:00.000Z',
};

describe('diffExpense', () => {
  it('finds nothing when only the time of day or the order of people changed', () => {
    const after: Expense = { ...base, date: '2026-09-28T18:30:00.000Z', splitBetween: [...base.splitBetween].reverse(), notes: '' };
    expect(diffExpense(base, after)).toEqual([]);
  });

  it('records the amount with the people it moved', () => {
    const after: Expense = {
      ...base,
      amount: 1_200_000,
      paidBy: [{ userId: 'dami', amount: 1_200_000 }],
      splitBetween: [
        { userId: 'dami', amount: 600_000 },
        { userId: 'tolu', amount: 600_000 },
      ],
    };
    expect(diffExpense(base, after).map((c) => c.field)).toEqual(['amount', 'paidBy', 'split']);
    expect(diffExpense(base, after)[0]).toEqual({ field: 'amount', from: 800_000, to: 1_200_000 });
  });

  it('records a change of split method even when the shares come out the same', () => {
    const after: Expense = { ...base, splitMethod: 'exact' };
    expect(diffExpense(base, after)).toEqual([{ field: 'split', from: base.splitBetween, to: base.splitBetween, fromMethod: 'equal', toMethod: 'exact' }]);
  });

  it('describes receipts as added, replaced or removed', () => {
    const withReceipt: Expense = { ...base, receiptUrl: '/receipts/a' };
    expect(diffExpense(base, withReceipt)).toEqual([{ field: 'receipt', change: 'added' }]);
    expect(diffExpense(withReceipt, { ...base, receiptUrl: '/receipts/b' })).toEqual([{ field: 'receipt', change: 'replaced' }]);
    expect(diffExpense(withReceipt, base)).toEqual([{ field: 'receipt', change: 'removed' }]);
  });

  it('records title, date, category and notes', () => {
    const after: Expense = { ...base, title: 'Fuel + snacks', date: '2026-09-27T12:00:00.000Z', category: 'transport', notes: 'Shell Lekki' };
    expect(diffExpense(base, after)).toEqual([
      { field: 'title', from: 'Fuel', to: 'Fuel + snacks' },
      { field: 'date', from: base.date, to: '2026-09-27T12:00:00.000Z' },
      { field: 'category', from: undefined, to: 'transport' },
      { field: 'notes', from: undefined, to: 'Shell Lekki' },
    ]);
  });
});
