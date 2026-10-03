import { expenseNetByUser } from '@/features/expenses/split';
import type { Expense, MinorUnits, Settlement } from '@/types/models';

import { computeBalances, simplifyDebts, type Transfer } from './balances';

/**
 * The working behind Smart Settlements, in the order a person checks it:
 * who owes whom if everyone paid back directly, where each person stands
 * overall, and the fewest payments that settle the same balances.
 */

export type Position = {
  userId: string;
  /** What they paid for bills. */
  paid: MinorUnits;
  /** Their share of bills. */
  share: MinorUnits;
  /** Confirmed payments they sent to others. */
  sent: MinorUnits;
  /** Confirmed payments they received. */
  received: MinorUnits;
  /** paid − share + sent − received. Positive: owed money. Negative: owes. */
  net: MinorUnits;
};

export type SettlementExplanation = {
  /** Payments needed if everyone paid back the people who covered them. */
  direct: Transfer[];
  positions: Position[];
  /** The simplified plan: the same balances in the fewest payments. */
  simplified: Transfer[];
};

type ExpenseLike = Pick<Expense, 'paidBy' | 'splitBetween'>;
type SettlementLike = Pick<Settlement, 'fromUserId' | 'toUserId' | 'amount'>;

/**
 * Within one bill, each person who owes pays back the people who paid more
 * than their share. One payer (the usual case) means each person owes that
 * payer their share; with several payers, debts fill the biggest payer first.
 * Whole minor units throughout, so nothing is lost to rounding.
 */
function billDebts(expense: ExpenseLike): Transfer[] {
  const credit: { id: string; amount: number }[] = [];
  const debt: { id: string; amount: number }[] = [];
  for (const [id, net] of expenseNetByUser(expense)) {
    if (net > 0) credit.push({ id, amount: net });
    else if (net < 0) debt.push({ id, amount: -net });
  }
  const order = (a: { id: string; amount: number }, b: { id: string; amount: number }) => b.amount - a.amount || a.id.localeCompare(b.id);
  credit.sort(order);
  debt.sort(order);

  const out: Transfer[] = [];
  let c = 0;
  for (const d of debt) {
    let left = d.amount;
    while (left > 0 && c < credit.length) {
      const take = Math.min(left, credit[c].amount);
      out.push({ fromUserId: d.id, toUserId: credit[c].id, amount: take });
      left -= take;
      credit[c].amount -= take;
      if (credit[c].amount === 0) c++;
    }
  }
  return out;
}

/**
 * Who owes whom, pair by pair, if nobody simplified: debts from every bill,
 * netted between each pair, less the confirmed payments between them.
 */
export function directDebts(expenses: ExpenseLike[], settlements: SettlementLike[]): Transfer[] {
  const pair = new Map<string, number>(); // "a|b" with a < b: positive means a owes b
  const add = (from: string, to: string, amount: number) => {
    if (from === to || amount === 0) return;
    const [a, b, sign] = from < to ? [from, to, 1] : [to, from, -1];
    const key = `${a}|${b}`;
    pair.set(key, (pair.get(key) ?? 0) + sign * amount);
  };
  for (const expense of expenses) for (const t of billDebts(expense)) add(t.fromUserId, t.toUserId, t.amount);
  // Paying someone back reduces what you owe them.
  for (const s of settlements) add(s.toUserId, s.fromUserId, s.amount);

  const out: Transfer[] = [];
  for (const [key, amount] of pair) {
    if (amount === 0) continue;
    const [a, b] = key.split('|');
    out.push(amount > 0 ? { fromUserId: a, toUserId: b, amount } : { fromUserId: b, toUserId: a, amount: -amount });
  }
  return out.sort((x, y) => y.amount - x.amount || x.fromUserId.localeCompare(y.fromUserId) || x.toUserId.localeCompare(y.toUserId));
}

export function positions(memberIds: string[], expenses: ExpenseLike[], settlements: SettlementLike[]): Position[] {
  const by = new Map<string, Position>(memberIds.map((userId) => [userId, { userId, paid: 0, share: 0, sent: 0, received: 0, net: 0 }]));
  const get = (userId: string) => {
    let p = by.get(userId);
    if (!p) by.set(userId, (p = { userId, paid: 0, share: 0, sent: 0, received: 0, net: 0 }));
    return p;
  };
  for (const e of expenses) {
    for (const payer of e.paidBy) get(payer.userId).paid += payer.amount;
    for (const split of e.splitBetween) get(split.userId).share += split.amount;
  }
  for (const s of settlements) {
    get(s.fromUserId).sent += s.amount;
    get(s.toUserId).received += s.amount;
  }
  for (const p of by.values()) p.net = p.paid - p.share + p.sent - p.received;
  return [...by.values()];
}

/** Settlements must already be the confirmed ones (the ones that count toward balances). */
export function explainSettlement(memberIds: string[], expenses: ExpenseLike[], settlements: SettlementLike[]): SettlementExplanation {
  return {
    direct: directDebts(expenses, settlements),
    positions: positions(memberIds, expenses, settlements),
    simplified: simplifyDebts(computeBalances(memberIds, expenses, settlements)),
  };
}

/** Each person's balance after a set of payments; all zero means the payments settle everyone. */
export function balancesAfter(positionsList: Position[], payments: Transfer[]): Map<string, MinorUnits> {
  const after = new Map(positionsList.map((p) => [p.userId, p.net]));
  for (const t of payments) {
    after.set(t.fromUserId, (after.get(t.fromUserId) ?? 0) + t.amount);
    after.set(t.toUserId, (after.get(t.toUserId) ?? 0) - t.amount);
  }
  return after;
}
