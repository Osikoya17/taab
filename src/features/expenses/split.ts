import type { ExpensePayer, ExpenseSplit, MinorUnits, SplitMethod } from '@/types/models';

/** Percentages are stored as basis points so 33.33% is the integer 3333. */
export const FULL_PERCENT_BP = 10_000;

export type SplitInput = {
  userId: string;
  /** exact: minor units · percentage: basis points · shares: share count · equal: ignored */
  value?: number;
};

export type SplitError =
  | { code: 'no_participants' }
  | { code: 'invalid_total' }
  | { code: 'invalid_value'; userId: string }
  | { code: 'exact_mismatch'; difference: MinorUnits }
  | { code: 'percentage_mismatch'; differenceBp: number }
  | { code: 'no_shares' };

export type SplitResult = { ok: true; splits: ExpenseSplit[] } | { ok: false; error: SplitError };

/**
 * Splits `total` across `weights` so the parts are integers that sum exactly to
 * `total`. Uses the largest-remainder method; ties go to the earlier index so
 * results are deterministic. BigInt keeps `total * weight` exact for any amount.
 */
export function allocateProportionally(total: MinorUnits, weights: number[]): MinorUnits[] {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new RangeError('Amounts and weights must be non-negative safe integers');
  }
  const bigSum = weights.reduce((sum, w) => sum + BigInt(w), 0n);
  if (weights.length === 0 || bigSum === 0n) return weights.map(() => 0);

  const bigTotal = BigInt(total);

  const parts = weights.map((w, index) => {
    const numerator = bigTotal * BigInt(w);
    return { index, base: numerator / bigSum, remainder: numerator % bigSum };
  });

  let leftover = bigTotal - parts.reduce((sum, p) => sum + p.base, 0n);
  const byRemainder = [...parts].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (const part of byRemainder) {
    if (leftover <= 0n) break;
    part.base += 1n;
    leftover -= 1n;
  }

  return parts.map((p) => Number(p.base));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Resolves who owes what for an expense. Pure and side-effect free. */
export function computeSplit(total: MinorUnits, method: SplitMethod, participants: SplitInput[]): SplitResult {
  if (!Number.isSafeInteger(total) || total <= 0) return { ok: false, error: { code: 'invalid_total' } };
  if (participants.length === 0) return { ok: false, error: { code: 'no_participants' } };
  const seen = new Set<string>();
  for (const participant of participants) {
    if (!participant.userId || seen.has(participant.userId)) return { ok: false, error: { code: 'invalid_value', userId: participant.userId } };
    seen.add(participant.userId);
  }

  switch (method) {
    case 'equal': {
      const amounts = allocateProportionally(
        total,
        participants.map(() => 1),
      );
      return { ok: true, splits: participants.map((p, i) => ({ userId: p.userId, amount: amounts[i] })) };
    }

    case 'exact': {
      for (const p of participants) {
        if (!isNonNegativeInteger(p.value)) return { ok: false, error: { code: 'invalid_value', userId: p.userId } };
      }
      const sum = participants.reduce((acc, p) => acc + (p.value ?? 0), 0);
      if (sum !== total) return { ok: false, error: { code: 'exact_mismatch', difference: total - sum } };
      return {
        ok: true,
        splits: participants.map((p) => ({ userId: p.userId, amount: p.value ?? 0, value: p.value })),
      };
    }

    case 'percentage': {
      for (const p of participants) {
        if (!isNonNegativeInteger(p.value)) return { ok: false, error: { code: 'invalid_value', userId: p.userId } };
      }
      const sumBp = participants.reduce((acc, p) => acc + (p.value ?? 0), 0);
      if (sumBp !== FULL_PERCENT_BP) {
        return { ok: false, error: { code: 'percentage_mismatch', differenceBp: FULL_PERCENT_BP - sumBp } };
      }
      const amounts = allocateProportionally(
        total,
        participants.map((p) => p.value ?? 0),
      );
      return {
        ok: true,
        splits: participants.map((p, i) => ({ userId: p.userId, amount: amounts[i], value: p.value })),
      };
    }

    case 'shares': {
      for (const p of participants) {
        if (!isNonNegativeInteger(p.value)) return { ok: false, error: { code: 'invalid_value', userId: p.userId } };
      }
      const shareSum = participants.reduce((acc, p) => acc + (p.value ?? 0), 0);
      if (shareSum === 0) return { ok: false, error: { code: 'no_shares' } };
      const amounts = allocateProportionally(
        total,
        participants.map((p) => p.value ?? 0),
      );
      return {
        ok: true,
        splits: participants.map((p, i) => ({ userId: p.userId, amount: amounts[i], value: p.value })),
      };
    }
  }
}

export type PayersError = { code: 'no_payers' } | { code: 'invalid_payers' } | { code: 'payers_mismatch'; difference: MinorUnits };

/**
 * Normalises who paid. With `amounts` omitted, the total is divided equally
 * between payers; otherwise the given amounts must add up to the total.
 */
export function resolvePayers(
  total: MinorUnits,
  payerIds: string[],
  amounts?: Record<string, MinorUnits>,
): { ok: true; payers: ExpensePayer[] } | { ok: false; error: PayersError } {
  if (payerIds.length === 0) return { ok: false, error: { code: 'no_payers' } };
  if (!Number.isSafeInteger(total) || total <= 0 || payerIds.some((id) => !id) || new Set(payerIds).size !== payerIds.length) {
    return { ok: false, error: { code: 'invalid_payers' } };
  }

  if (!amounts || payerIds.length === 1) {
    const parts = allocateProportionally(
      total,
      payerIds.map(() => 1),
    );
    return { ok: true, payers: payerIds.map((userId, i) => ({ userId, amount: parts[i] })) };
  }

  const payers = payerIds.map((userId) => ({ userId, amount: amounts[userId] ?? 0 }));
  if (payers.some((p) => !isNonNegativeInteger(p.amount))) return { ok: false, error: { code: 'invalid_payers' } };
  const sum = payers.reduce((acc, p) => acc + p.amount, 0);
  if (sum !== total) return { ok: false, error: { code: 'payers_mismatch', difference: total - sum } };
  return { ok: true, payers };
}

/**
 * Net effect of one expense per person: positive means they are owed money,
 * negative means they owe. Always sums to zero.
 */
export function expenseNetByUser(expense: { paidBy: ExpensePayer[]; splitBetween: ExpenseSplit[] }): Map<string, MinorUnits> {
  const net = new Map<string, MinorUnits>();
  for (const payer of expense.paidBy) net.set(payer.userId, (net.get(payer.userId) ?? 0) + payer.amount);
  for (const split of expense.splitBetween) net.set(split.userId, (net.get(split.userId) ?? 0) - split.amount);
  return net;
}

/** Converts a human percentage ("33.33") to basis points without float drift. */
export function percentToBasisPoints(text: string): number | null {
  const cleaned = text.trim();
  if (!/^\d{1,3}(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const bp = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return bp <= FULL_PERCENT_BP ? bp : null;
}

export function basisPointsToPercentString(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}
