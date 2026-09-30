import type { Group } from '@/types/models';

import { buildExpenseInput, defaultFormValues, formValuesFromExpense, previewSplit, scanPrefill, type ExpenseFormValues } from './expense-form';

const group: Group = {
  id: 'g1',
  name: 'Flat 12',
  type: 'home',
  currency: 'NGN',
  members: ['me', 'gbayin', 'macky', 'dami'].map((userId) => ({ userId, name: userId, status: 'active' as const, joinedAt: '' })),
  createdBy: 'me',
  createdAt: '',
  updatedAt: '',
};
const nameOf = (id: string) => (id === 'gbayin' ? 'Gbayin' : id);

function values(patch: Partial<ExpenseFormValues>): ExpenseFormValues {
  return { ...defaultFormValues(group, 'me'), title: 'Dinner at Nok', amount: 4_800_000, ...patch };
}

describe('expense form', () => {
  it('defaults to you paying and everyone splitting equally', () => {
    const v = defaultFormValues(group, 'me');
    expect(v.payerIds).toEqual(['me']);
    expect(v.participantIds).toEqual(['me', 'gbayin', 'macky', 'dami']);
    expect(v.splitMethod).toBe('equal');
  });

  it('builds an equal split', () => {
    const result = buildExpenseInput(values({}), 'NGN', nameOf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.paidBy).toEqual([{ userId: 'me', amount: 4_800_000 }]);
    expect(result.input.splitBetween.map((s) => s.amount)).toEqual([1_200_000, 1_200_000, 1_200_000, 1_200_000]);
  });

  it('explains exact amounts that do not add up', () => {
    const v = values({ splitMethod: 'exact', participantIds: ['me', 'gbayin'], splitValues: { me: '30000', gbayin: '10000' } });
    expect(previewSplit(v, 'NGN', nameOf)).toMatchObject({ ok: false, message: '₦8,000 left to assign' });
    const over = values({ splitMethod: 'exact', participantIds: ['me', 'gbayin'], splitValues: { me: '40000', gbayin: '10000' } });
    expect(previewSplit(over, 'NGN', nameOf)).toMatchObject({ ok: false, message: '₦2,000 over the total' });
  });

  it('validates percentages', () => {
    const v = values({ splitMethod: 'percentage', participantIds: ['me', 'gbayin'], splitValues: { me: '60', gbayin: '30' } });
    expect(previewSplit(v, 'NGN', nameOf)).toMatchObject({ ok: false, message: '10% left to assign' });
    const good = values({ splitMethod: 'percentage', participantIds: ['me', 'gbayin'], splitValues: { me: '62.5', gbayin: '37.5' } });
    expect(previewSplit(good, 'NGN', nameOf)).toEqual({ ok: true, amounts: { me: 3_000_000, gbayin: 1_800_000 } });
  });

  it('treats blank shares as one share each', () => {
    const v = values({ splitMethod: 'shares', participantIds: ['me', 'gbayin', 'macky'], splitValues: { me: '2' } });
    expect(previewSplit(v, 'NGN', nameOf)).toEqual({ ok: true, amounts: { me: 2_400_000, gbayin: 1_200_000, macky: 1_200_000 } });
  });

  it('names the person with an invalid value', () => {
    const v = values({ splitMethod: 'shares', participantIds: ['me', 'gbayin'], splitValues: { gbayin: 'x' } });
    expect(previewSplit(v, 'NGN', nameOf)).toMatchObject({ ok: false, message: 'Check Gbayin’s shares' });
  });

  it('supports multiple payers with custom amounts', () => {
    const v = values({ payerIds: ['me', 'gbayin'], payerMode: 'custom', payerAmounts: { me: '30000', gbayin: '18000' } });
    const result = buildExpenseInput(v, 'NGN', nameOf);
    expect(result.ok && result.input.paidBy).toEqual([
      { userId: 'me', amount: 3_000_000 },
      { userId: 'gbayin', amount: 1_800_000 },
    ]);
    const short = buildExpenseInput(values({ payerIds: ['me', 'gbayin'], payerMode: 'custom', payerAmounts: { me: '30000' } }), 'NGN', nameOf);
    expect(short).toEqual({ ok: false, field: 'payers', message: 'Payers are ₦18,000 short' });
  });

  it('round-trips an existing expense for editing', () => {
    const built = buildExpenseInput(values({ splitMethod: 'percentage', participantIds: ['me', 'gbayin'], splitValues: { me: '62.5', gbayin: '37.5' } }), 'NGN', nameOf);
    if (!built.ok) throw new Error('expected ok');
    const expense = { ...built.input, id: 'e1', currency: 'NGN' as const, createdBy: 'me', createdAt: '', updatedAt: '' };
    const back = formValuesFromExpense(expense);
    expect(back.splitValues).toEqual({ me: '62.5', gbayin: '37.5' });
    expect(back.payerMode).toBe('equal');
    expect(buildExpenseInput(back, 'NGN', nameOf)).toMatchObject({ ok: true, input: { splitBetween: built.input.splitBetween } });
  });
});

describe('scanPrefill', () => {
  const draft = { merchant: 'Mama Put', total: 129_000, date: '2026-09-01', items: [], charges: [], warnings: [], source: 'demo' as const };
  const now = new Date('2026-09-10T09:00:00.000Z');

  it('starts the form from a reviewed scan, photo and link included', () => {
    const values = scanPrefill({ id: 'scan_1', receiptUrl: '/receipts/abc', draft }, now);
    expect(values).toMatchObject({ title: 'Mama Put', amount: 129_000, receiptUri: '/receipts/abc', scanId: 'scan_1' });
    expect(values.date!.slice(0, 10)).toBe('2026-09-01');
  });

  it('leaves what the scanner missed for the person, and never dates a bill in the future', () => {
    const values = scanPrefill({ id: 'scan_2', receiptUrl: 'x', draft: { ...draft, merchant: undefined, total: undefined, date: '2027-01-01' } }, now);
    expect(values).toMatchObject({ title: '', amount: 0 });
    expect(values.date).toBe(now.toISOString());
    expect(scanPrefill(undefined)).toEqual({});
  });
});
