import { CATEGORY_LABELS } from '@/features/expenses/category-labels';
import { computeBalances, countsTowardBalance, simplifyDebts } from '@/features/settlements/balances';
import type { CurrencyCode, Expense, ExpenseCategory, Group, MinorUnits, Settlement } from '@/types/models';

export type ReportPayment = { date: string; from: string; to: string; amount: MinorUnits };

export type GroupReport = {
  groupName: string;
  currency: CurrencyCode;
  generatedAt: string;
  /** First and last expense dates, or null when there are none. */
  period: { from: string; to: string } | null;
  totals: { spent: MinorUnits; expenseCount: number; perMember: MinorUnits };
  byCategory: { label: string; amount: MinorUnits; share: number }[];
  members: { name: string; paid: MinorUnits; share: MinorUnits; balance: MinorUnits }[];
  expenses: { date: string; title: string; amount: MinorUnits; paidBy: string; category: string; scanned: boolean }[];
  /** Only confirmed payments move balances; the others are listed so nothing is hidden. */
  payments: { confirmed: ReportPayment[]; waiting: ReportPayment[]; notReceived: ReportPayment[] };
  settleUp: { from: string; to: string; amount: MinorUnits }[];
};

/** Everything a trip or event summary needs, worked out from the raw ledger. */
export function buildGroupReport(group: Group, expenses: Expense[], settlements: Settlement[], now = new Date()): GroupReport {
  const nameOf = (id: string) => group.members.find((m) => m.userId === id)?.name ?? 'Former member';
  const ordered = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const spent = ordered.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = new Map<ExpenseCategory, MinorUnits>();
  for (const e of ordered) categoryTotals.set(e.category ?? 'other', (categoryTotals.get(e.category ?? 'other') ?? 0) + e.amount);

  const ids = [...new Set([...group.members.map((m) => m.userId), ...ordered.flatMap((e) => [...e.paidBy, ...e.splitBetween].map((p) => p.userId))])];
  const confirmed = settlements.filter(countsTowardBalance);
  const balances = computeBalances(ids, ordered, confirmed);
  const paid = (id: string) => ordered.reduce((sum, e) => sum + (e.paidBy.find((p) => p.userId === id)?.amount ?? 0), 0);
  const share = (id: string) => ordered.reduce((sum, e) => sum + (e.splitBetween.find((s) => s.userId === id)?.amount ?? 0), 0);
  const payment = (s: Settlement): ReportPayment => ({ date: s.createdAt, from: nameOf(s.fromUserId), to: nameOf(s.toUserId), amount: s.amount });
  const byDate = (a: Settlement, b: Settlement) => a.createdAt.localeCompare(b.createdAt);

  return {
    groupName: group.name,
    currency: group.currency,
    generatedAt: now.toISOString(),
    period: ordered.length ? { from: ordered[0].date, to: ordered[ordered.length - 1].date } : null,
    totals: { spent, expenseCount: ordered.length, perMember: group.members.length ? Math.round(spent / group.members.length) : 0 },
    byCategory: [...categoryTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ label: CATEGORY_LABELS[category], amount, share: spent ? amount / spent : 0 })),
    members: ids.map((id) => ({ name: nameOf(id), paid: paid(id), share: share(id), balance: balances.get(id) ?? 0 })),
    expenses: ordered.map((e) => ({
      date: e.date, title: e.title, amount: e.amount, scanned: !!e.scanId,
      paidBy: e.paidBy.filter((p) => p.amount > 0).map((p) => nameOf(p.userId)).join(', '),
      category: CATEGORY_LABELS[e.category ?? 'other'],
    })),
    payments: {
      confirmed: confirmed.sort(byDate).map(payment),
      waiting: settlements.filter((s) => s.status === 'pending').sort(byDate).map(payment),
      notReceived: settlements.filter((s) => s.status === 'declined').sort(byDate).map(payment),
    },
    settleUp: simplifyDebts(balances).map((t) => ({ from: nameOf(t.fromUserId), to: nameOf(t.toUserId), amount: t.amount })),
  };
}
