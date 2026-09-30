import { expenseNetByUser } from '@/features/expenses/split';
import type { CurrencyCode, Expense, MinorUnits, Settlement } from '@/types/models';

/** userId → net balance. Positive: the group owes them. Negative: they owe the group. */
export type Balances = Map<string, MinorUnits>;

export type Transfer = {
  fromUserId: string;
  toUserId: string;
  amount: MinorUnits;
};

/** Pending and declined payments don't move balances; older payments without a status do. */
export function countsTowardBalance(settlement: Pick<Settlement, 'status'>): boolean {
  return (settlement.status ?? 'confirmed') === 'confirmed';
}

/**
 * Net balance of every member from the raw ledger. Expenses and settlements
 * are never mutated — balances are always derived.
 */
export function computeBalances(
  memberIds: string[],
  expenses: Pick<Expense, 'paidBy' | 'splitBetween'>[],
  settlements: Pick<Settlement, 'fromUserId' | 'toUserId' | 'amount'>[],
): Balances {
  const balances: Balances = new Map(memberIds.map((id) => [id, 0]));
  const add = (id: string, delta: MinorUnits) => balances.set(id, (balances.get(id) ?? 0) + delta);

  for (const expense of expenses) {
    for (const [userId, delta] of expenseNetByUser(expense)) add(userId, delta);
  }
  // Paying someone back reduces what you owe (raises your balance) and
  // reduces what they are owed.
  for (const s of settlements) {
    add(s.fromUserId, s.amount);
    add(s.toUserId, -s.amount);
  }
  return balances;
}

/**
 * Reduces a balance sheet to a small set of transfers that settles everyone.
 * Greedy: repeatedly match the largest debtor with the largest creditor. This
 * produces at most n−1 transfers and never routes money through someone who
 * is already even. Ties break on userId so output is stable.
 */
export function simplifyDebts(balances: Balances): Transfer[] {
  const debtors: { id: string; amount: MinorUnits }[] = [];
  const creditors: { id: string; amount: MinorUnits }[] = [];
  for (const [id, amount] of balances) {
    if (amount < 0) debtors.push({ id, amount: -amount });
    else if (amount > 0) creditors.push({ id, amount });
  }

  const byAmountDesc = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount - a.amount || a.id.localeCompare(b.id);

  const transfers: Transfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmountDesc);
    creditors.sort(byAmountDesc);
    const debtor = debtors[0];
    const creditor = creditors[0];
    const amount = Math.min(debtor.amount, creditor.amount);

    transfers.push({ fromUserId: debtor.id, toUserId: creditor.id, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }
  return transfers;
}

/** Total that still needs to move for the group to be even. */
export function totalOutstanding(balances: Balances): MinorUnits {
  let sum = 0;
  for (const amount of balances.values()) if (amount > 0) sum += amount;
  return sum;
}

export type ExpenseSettlementStatus = 'settled' | 'partial' | 'unsettled';

/**
 * Derives whether each expense has been paid back.
 *
 * A member's outstanding debt is what they owe right now (from `balances`).
 * Everything they owed across expenses beyond that has, by definition, been
 * covered — by paying people back or by others owing them. That covered
 * amount is applied oldest-expense-first, so older bills settle before newer
 * ones. An expense is settled once every member who owed on it is covered.
 */
export function computeExpenseStatuses(
  expenses: Pick<Expense, 'id' | 'date' | 'paidBy' | 'splitBetween'>[],
  balances: Balances,
): Map<string, ExpenseSettlementStatus> {
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  // What each member owes on each expense after offsetting what they paid on it.
  const owedByExpense = sorted.map((expense) => {
    const owing = new Map<string, MinorUnits>();
    for (const [userId, net] of expenseNetByUser(expense)) if (net < 0) owing.set(userId, -net);
    return { id: expense.id, owing };
  });

  const totalOwed = new Map<string, MinorUnits>();
  for (const { owing } of owedByExpense) {
    for (const [userId, amount] of owing) totalOwed.set(userId, (totalOwed.get(userId) ?? 0) + amount);
  }

  const coverage = new Map<string, MinorUnits>();
  for (const [userId, owed] of totalOwed) {
    const outstanding = Math.max(0, -(balances.get(userId) ?? 0));
    coverage.set(userId, Math.max(0, owed - outstanding));
  }

  const statuses = new Map<string, ExpenseSettlementStatus>();
  for (const { id, owing } of owedByExpense) {
    if (owing.size === 0) {
      statuses.set(id, 'settled');
      continue;
    }
    let owedTotal = 0;
    let coveredTotal = 0;
    for (const [userId, amount] of owing) {
      const available = coverage.get(userId) ?? 0;
      const applied = Math.min(available, amount);
      coverage.set(userId, available - applied);
      owedTotal += amount;
      coveredTotal += applied;
    }
    statuses.set(id, coveredTotal === 0 ? 'unsettled' : coveredTotal >= owedTotal ? 'settled' : 'partial');
  }
  return statuses;
}

export type MoneySummary = { owed: MinorUnits; owe: MinorUnits; net: MinorUnits };

/** Rolls a user's per-group balances into owed/owe totals, separately per currency. */
export function summarizeForUser(
  userId: string,
  groups: { currency: CurrencyCode; balances: Balances }[],
): Map<CurrencyCode, MoneySummary> {
  const summary = new Map<CurrencyCode, MoneySummary>();
  for (const group of groups) {
    const net = group.balances.get(userId) ?? 0;
    const current = summary.get(group.currency) ?? { owed: 0, owe: 0, net: 0 };
    if (net > 0) current.owed += net;
    if (net < 0) current.owe += -net;
    current.net += net;
    summary.set(group.currency, current);
  }
  return summary;
}
