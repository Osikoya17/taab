import { z } from 'zod';

import type { ScanDraft } from '@/features/billing/types';
import { convertMinor, rateBetween, type ExchangeRates } from '@/features/currency/rates';
import type { ExpenseInput } from '@/services/expenses.service';
import type { CurrencyCode, Expense, ExpenseCategory, ExpenseSplit, Group, MinorUnits, SplitMethod } from '@/types/models';
import { formatMoney, parseMoneyInput, toInputString } from '@/utils/money';

import { allocateProportionally, basisPointsToPercentString, computeSplit, percentToBasisPoints, resolvePayers, type SplitInput } from './split';

export const expenseFormSchema = z.object({
  groupId: z.string().min(1, 'Choose a taab'),
  amount: z.number().int().positive('Enter an amount'),
  title: z.string().trim().min(1, 'Add a short description').max(80, 'Keep it under 80 characters'),
  payerIds: z.array(z.string()).min(1, 'Choose who paid'),
  payerMode: z.enum(['equal', 'custom']),
  payerAmounts: z.record(z.string(), z.string()),
  participantIds: z.array(z.string()).min(1, 'Choose at least one person'),
  splitMethod: z.enum(['equal', 'exact', 'percentage', 'shares']),
  splitValues: z.record(z.string(), z.string()),
  date: z.iso.datetime(),
  notes: z.string().max(500),
  category: z.string().optional(),
  receiptUri: z.string().optional(),
  /** The reviewed receipt scan this expense was filled from. */
  scanId: z.string().optional(),
  repeat: z.enum(['off', 'weekly', 'monthly']),
  repeatAuto: z.boolean(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function defaultFormValues(group: Group | undefined, meId: string): ExpenseFormValues {
  return {
    groupId: group?.id ?? '',
    amount: 0,
    title: '',
    payerIds: [meId],
    payerMode: 'equal',
    payerAmounts: {},
    participantIds: group?.members.map((m) => m.userId) ?? [meId],
    splitMethod: 'equal',
    splitValues: {},
    date: new Date().toISOString(),
    notes: '',
    category: undefined,
    receiptUri: undefined,
    repeat: 'off',
    repeatAuto: false,
  };
}

export function formValuesFromExpense(expense: Expense): ExpenseFormValues {
  const splitValues: Record<string, string> = {};
  for (const s of expense.splitBetween) {
    if (expense.splitMethod === 'exact') splitValues[s.userId] = toInputString(s.amount, expense.currency);
    if (expense.splitMethod === 'percentage' && s.value !== undefined) splitValues[s.userId] = basisPointsToPercentString(s.value);
    if (expense.splitMethod === 'shares' && s.value !== undefined) splitValues[s.userId] = String(s.value);
  }
  const payerAmounts: Record<string, string> = {};
  for (const p of expense.paidBy) payerAmounts[p.userId] = toInputString(p.amount, expense.currency);
  const equalPayers = resolvePayers(
    expense.amount,
    expense.paidBy.map((p) => p.userId),
  );
  const payersAreEqual =
    equalPayers.ok && equalPayers.payers.every((p, i) => p.amount === expense.paidBy[i]?.amount);

  return {
    groupId: expense.groupId,
    amount: expense.amount,
    title: expense.title,
    payerIds: expense.paidBy.map((p) => p.userId),
    payerMode: payersAreEqual ? 'equal' : 'custom',
    payerAmounts,
    participantIds: expense.splitBetween.map((s) => s.userId),
    splitMethod: expense.splitMethod,
    splitValues,
    date: expense.date,
    notes: expense.notes ?? '',
    category: expense.category,
    receiptUri: expense.receiptUrl,
    repeat: 'off',
    repeatAuto: false,
  };
}

/** Parses one person's raw split input for the chosen method. */
export function parseSplitValue(method: SplitMethod, text: string | undefined, currency: CurrencyCode): number | undefined {
  const raw = (text ?? '').trim();
  if (method === 'equal') return undefined;
  if (raw === '') return method === 'shares' ? 1 : 0;
  if (method === 'exact') return parseMoneyInput(raw, currency) ?? Number.NaN;
  if (method === 'percentage') return percentToBasisPoints(raw) ?? Number.NaN;
  return /^\d{1,3}$/.test(raw) ? Number(raw) : Number.NaN;
}

export type SplitPreview =
  | { ok: true; amounts: Record<string, MinorUnits> }
  | { ok: false; message: string; amounts: Record<string, MinorUnits> };

/** Live preview of each share plus a friendly message when inputs don't add up. */
export function previewSplit(values: Pick<ExpenseFormValues, 'amount' | 'participantIds' | 'splitMethod' | 'splitValues'>, currency: CurrencyCode, nameOf: (id: string) => string): SplitPreview {
  const inputs: SplitInput[] = values.participantIds.map((userId) => ({
    userId,
    value: parseSplitValue(values.splitMethod, values.splitValues[userId], currency),
  }));

  if (values.amount <= 0) return { ok: false, message: 'Enter an amount first', amounts: {} };
  const result = computeSplit(values.amount, values.splitMethod, inputs);
  if (result.ok) return { ok: true, amounts: Object.fromEntries(result.splits.map((s) => [s.userId, s.amount])) };

  // Best-effort amounts so rows still show something while the user types.
  const partial: Record<string, MinorUnits> = {};
  if (values.splitMethod === 'exact') for (const i of inputs) partial[i.userId] = Number.isFinite(i.value) ? (i.value ?? 0) : 0;

  const error = result.error;
  switch (error.code) {
    case 'no_participants':
      return { ok: false, message: 'Choose at least one person', amounts: partial };
    case 'invalid_total':
      return { ok: false, message: 'Enter an amount first', amounts: partial };
    case 'invalid_value':
      return { ok: false, message: `Check ${nameOf(error.userId)}’s ${values.splitMethod === 'shares' ? 'shares' : 'amount'}`, amounts: partial };
    case 'exact_mismatch':
      return {
        ok: false,
        message: error.difference > 0 ? `${formatMoney(error.difference, currency)} left to assign` : `${formatMoney(-error.difference, currency)} over the total`,
        amounts: partial,
      };
    case 'percentage_mismatch': {
      const pct = basisPointsToPercentString(Math.abs(error.differenceBp));
      return { ok: false, message: error.differenceBp > 0 ? `${pct}% left to assign` : `${pct}% over 100%`, amounts: partial };
    }
    case 'no_shares':
      return { ok: false, message: 'Give at least one person a share', amounts: partial };
  }
}

/**
 * Re-expresses an expense typed in another currency in the taab's currency.
 * The total is converted once; shares and payer amounts are then rebuilt from
 * it with the same largest-remainder maths the server re-checks, so everything
 * still adds up to the exact total. Returns null if it rounds to nothing.
 */
export function convertExpenseInput(input: ExpenseInput, from: CurrencyCode, to: CurrencyCode, rates: ExchangeRates): ExpenseInput | null {
  if (from === to) return input;
  const amount = convertMinor(input.amount, from, to, rates);
  if (amount <= 0) return null;

  const paid = allocateProportionally(amount, input.paidBy.map((p) => p.amount));
  let splitBetween: ExpenseSplit[];
  if (input.splitMethod === 'exact') {
    const parts = allocateProportionally(amount, input.splitBetween.map((s) => s.amount));
    splitBetween = input.splitBetween.map((s, i) => ({ userId: s.userId, amount: parts[i], value: parts[i] }));
  } else {
    // Equal, percentage and shares don't depend on the currency: re-run the split.
    const result = computeSplit(amount, input.splitMethod, input.splitBetween.map((s) => ({ userId: s.userId, value: s.value })));
    if (!result.ok) return null;
    splitBetween = result.splits;
  }

  return {
    ...input,
    amount,
    paidBy: input.paidBy.map((p, i) => ({ userId: p.userId, amount: paid[i] })),
    splitBetween,
    original: { amount: input.amount, currency: from, rate: rateBetween(from, to, rates) },
  };
}

export type BuildResult =
  | { ok: true; input: ExpenseInput; recurring?: { frequency: 'weekly' | 'monthly'; autoCreate: boolean } }
  | { ok: false; field: 'split' | 'payers'; message: string };

/** Turns validated form values into the service payload. */
export function buildExpenseInput(values: ExpenseFormValues, currency: CurrencyCode, nameOf: (id: string) => string): BuildResult {
  const preview = previewSplit(values, currency, nameOf);
  if (!preview.ok) return { ok: false, field: 'split', message: preview.message };

  let payerAmounts: Record<string, MinorUnits> | undefined;
  if (values.payerIds.length > 1 && values.payerMode === 'custom') {
    payerAmounts = {};
    for (const id of values.payerIds) {
      const parsed = parseMoneyInput(values.payerAmounts[id]?.trim() || '0', currency);
      if (parsed === null) return { ok: false, field: 'payers', message: `Check ${nameOf(id)}’s payment amount` };
      payerAmounts[id] = parsed;
    }
  }
  const payers = resolvePayers(values.amount, values.payerIds, payerAmounts);
  if (!payers.ok) {
    const message =
      payers.error.code === 'no_payers'
        ? 'Choose who paid'
        : payers.error.code === 'invalid_payers'
          ? 'Check the payer amounts and choose each person once'
        : payers.error.difference > 0
          ? `Payers are ${formatMoney(payers.error.difference, currency)} short`
          : `Payers are ${formatMoney(-payers.error.difference, currency)} over`;
    return { ok: false, field: 'payers', message };
  }

  const splitBetween = values.participantIds.map((userId) => {
    const value = parseSplitValue(values.splitMethod, values.splitValues[userId], currency);
    return { userId, amount: preview.amounts[userId] ?? 0, ...(value !== undefined ? { value } : {}) };
  });

  return {
    ok: true,
    input: {
      groupId: values.groupId,
      title: values.title.trim(),
      amount: values.amount,
      paidBy: payers.payers,
      splitBetween,
      splitMethod: values.splitMethod,
      date: values.date,
      category: values.category as ExpenseCategory | undefined,
      notes: values.notes.trim() || undefined,
      receiptUrl: values.receiptUri,
      scanId: values.scanId,
    },
    recurring: values.repeat === 'off' ? undefined : { frequency: values.repeat, autoCreate: values.repeatAuto },
  };
}

/**
 * A reviewed scan as starting values. Anything the scanner didn't read stays
 * empty for the person to fill in, and a future date falls back to today.
 */
export function scanPrefill(scan?: { id: string; receiptUrl: string; draft?: ScanDraft }, now = new Date()): Partial<ExpenseFormValues> {
  if (!scan?.draft) return {};
  const { merchant, total, date } = scan.draft;
  const day = date ? new Date(`${date}T12:00:00`) : null;
  return {
    title: (merchant ?? '').slice(0, 80),
    amount: total ?? 0,
    date: day && !Number.isNaN(day.getTime()) && day <= now ? day.toISOString() : now.toISOString(),
    receiptUri: scan.receiptUrl,
    scanId: scan.id,
  };
}
