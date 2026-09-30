import { buildExpenseInput, convertExpenseInput, defaultFormValues, type ExpenseFormValues } from '@/features/expenses/expense-form';
import { validateExpense, type ExpenseInput } from '@/services/expenses.service';
import type { MockDatabase } from '@/services/mock/db';
import type { Group } from '@/types/models';

import { formatRate, parseRates, rateBetween, toDisplay } from './rates';

const rates = parseRates({
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: 1790553751,
  rates: { USD: 1, NGN: 1327.301923, GBP: 0.755594, EUR: 0.878356 },
});

const group: Group = {
  id: 'g1',
  name: 'Flat 12',
  type: 'home',
  currency: 'NGN',
  members: ['me', 'gbayin', 'macky'].map((userId) => ({ userId, name: userId, status: 'active' as const, joinedAt: '' })),
  createdBy: 'me',
  createdAt: '',
  updatedAt: '',
};
// Every split method is free, so an empty account is enough.
const db = { subscriptions: {}, scanJobs: {} } as unknown as MockDatabase;

/** Builds an expense typed in dollars, exactly as the form does. */
function typedInDollars(patch: Partial<ExpenseFormValues>): ExpenseInput {
  const built = buildExpenseInput({ ...defaultFormValues(group, 'me'), title: 'Dinner', amount: 1000, ...patch }, 'USD', (id) => id);
  if (!built.ok) throw new Error(built.message);
  return built.input;
}

function inNaira(input: ExpenseInput) {
  const converted = convertExpenseInput(input, 'USD', 'NGN', rates);
  if (!converted) throw new Error('conversion failed');
  return converted;
}

const sum = (parts: { amount: number }[]) => parts.reduce((total, p) => total + p.amount, 0);

describe('expenses entered in another currency', () => {
  it('converts the total once and keeps what was typed', () => {
    const expense = inNaira(typedInDollars({}));
    expect(expense.amount).toBe(1_327_302); // $10 → ₦13,273.02
    expect(expense.original).toEqual({ amount: 1000, currency: 'USD', rate: rateBetween('USD', 'NGN', rates) });
    expect(expense.paidBy).toEqual([{ userId: 'me', amount: 1_327_302 }]);
    expect(expense.splitBetween.map((s) => s.amount)).toEqual([442_434, 442_434, 442_434]);
  });

  it.each([
    ['equally', {}],
    ['by exact amounts', { splitMethod: 'exact' as const, splitValues: { me: '5', gbayin: '3.33', macky: '1.67' } }],
    ['by percentage', { splitMethod: 'percentage' as const, splitValues: { me: '33.33', gbayin: '33.33', macky: '33.34' } }],
    ['by shares', { splitMethod: 'shares' as const, splitValues: { me: '2', gbayin: '1', macky: '1' } }],
    ['with several payers', { payerIds: ['me', 'gbayin'], payerMode: 'custom' as const, payerAmounts: { me: '7', gbayin: '3' } }],
  ])('passes the server’s own checks when split %s', (_label, patch) => {
    const expense = inNaira(typedInDollars(patch));
    expect(sum(expense.paidBy)).toBe(expense.amount);
    expect(sum(expense.splitBetween)).toBe(expense.amount);
    expect(() => validateExpense(db, group, 'me', expense)).not.toThrow();
  });

  it('keeps exact shares in proportion', () => {
    const expense = inNaira(typedInDollars({ splitMethod: 'exact', splitValues: { me: '7', gbayin: '3', macky: '0' } }));
    expect(expense.splitBetween.map((s) => s.amount)).toEqual([929_111, 398_191, 0]);
  });

  it('refuses amounts that round to nothing', () => {
    expect(convertExpenseInput({ ...typedInDollars({}), amount: 1, paidBy: [{ userId: 'me', amount: 1 }], splitBetween: [{ userId: 'me', amount: 1 }] }, 'NGN', 'USD', rates)).toBeNull();
  });

  it('leaves an expense in the taab’s own currency untouched', () => {
    const input = typedInDollars({});
    expect(convertExpenseInput(input, 'NGN', 'NGN', rates)).toBe(input);
  });
});

describe('display currency', () => {
  it('shows ledger amounts in the chosen currency', () => {
    expect(toDisplay(1_000_000, 'NGN', 'USD', rates)).toEqual({ amount: 753, currency: 'USD', converted: true }); // ₦10,000 → $7.53
    expect(toDisplay(1_000_000, 'NGN', 'GBP', rates)).toEqual({ amount: 569, currency: 'GBP', converted: true }); // ₦10,000 → £5.69
  });

  it('falls back to the original currency without a choice or rates', () => {
    expect(toDisplay(1_000_000, 'NGN', null, rates)).toEqual({ amount: 1_000_000, currency: 'NGN', converted: false });
    expect(toDisplay(1_000_000, 'NGN', 'USD', undefined)).toEqual({ amount: 1_000_000, currency: 'NGN', converted: false });
    expect(toDisplay(1_000_000, 'NGN', 'NGN', rates)).toEqual({ amount: 1_000_000, currency: 'NGN', converted: false });
  });

  it('quotes rates from the stronger currency', () => {
    expect(formatRate(rateBetween('USD', 'NGN', rates), 'USD', 'NGN')).toBe('$1 = ₦1,327.30');
    expect(formatRate(rateBetween('NGN', 'USD', rates), 'NGN', 'USD')).toBe('$1 = ₦1,327.30');
    expect(formatRate(rateBetween('GBP', 'EUR', rates), 'GBP', 'EUR')).toBe('£1 = €1.16');
  });
});
