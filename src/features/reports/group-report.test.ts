import type { Expense, Group, Settlement } from '@/types/models';

import { buildGroupReport } from './group-report';
import { renderGroupReportHtml } from './render-html';

const group: Group = {
  id: 'g1', name: 'Ilashe <weekend>', type: 'trip', currency: 'NGN', createdBy: 'a', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  members: [
    { userId: 'a', name: 'Ada', status: 'active', joinedAt: '2026-09-01T00:00:00.000Z' },
    { userId: 'b', name: 'Bayo', status: 'active', joinedAt: '2026-09-01T00:00:00.000Z' },
  ],
};

const expense = (id: string, amount: number, payer: string, date: string, extra: Partial<Expense> = {}): Expense => ({
  id, groupId: 'g1', title: `Bill ${id}`, amount, currency: 'NGN', paidBy: [{ userId: payer, amount }],
  splitBetween: [{ userId: 'a', amount: amount / 2 }, { userId: 'b', amount: amount / 2 }], splitMethod: 'equal',
  date, createdBy: payer, createdAt: date, updatedAt: date, ...extra,
});

const payment = (id: string, amount: number, status?: Settlement['status']): Settlement => ({
  id, groupId: 'g1', fromUserId: 'b', toUserId: 'a', amount, currency: 'NGN', status, createdBy: 'b', createdAt: '2026-09-05T00:00:00.000Z',
});

describe('buildGroupReport', () => {
  const report = buildGroupReport(
    group,
    [expense('2', 4_000, 'a', '2026-09-03T00:00:00.000Z', { category: 'food', scanId: 'scan_1' }), expense('1', 10_000, 'a', '2026-09-02T00:00:00.000Z', { category: 'travel' })],
    [payment('p1', 2_000, 'confirmed'), payment('p2', 1_000, 'pending'), payment('p3', 500, 'declined'), payment('p0', 1_000)],
    new Date('2026-09-10T00:00:00.000Z'),
  );

  it('totals spending in date order, by category', () => {
    expect(report.period).toEqual({ from: '2026-09-02T00:00:00.000Z', to: '2026-09-03T00:00:00.000Z' });
    expect(report.totals).toEqual({ spent: 14_000, expenseCount: 2, perMember: 7_000 });
    expect(report.byCategory.map((c) => [c.label, c.amount])).toEqual([['Travel', 10_000], ['Food & drink', 4_000]]);
    expect(report.expenses.map((e) => e.scanned)).toEqual([false, true]);
  });

  it('counts only confirmed payments in balances and lists the rest separately', () => {
    // Bayo owed 7,000; 2,000 confirmed plus 1,000 from before confirmation existed.
    expect(report.members).toEqual([
      { name: 'Ada', paid: 14_000, share: 7_000, balance: 4_000 },
      { name: 'Bayo', paid: 0, share: 7_000, balance: -4_000 },
    ]);
    expect(report.payments.confirmed.map((p) => p.amount)).toEqual([2_000, 1_000]);
    expect(report.payments.waiting.map((p) => p.amount)).toEqual([1_000]);
    expect(report.payments.notReceived.map((p) => p.amount)).toEqual([500]);
    expect(report.settleUp).toEqual([{ from: 'Bayo', to: 'Ada', amount: 4_000 }]);
  });

  it('renders a page with everything people typed escaped', () => {
    const html = renderGroupReportHtml(report);
    expect(html).toContain('Ilashe &lt;weekend&gt;');
    expect(html).not.toContain('<weekend>');
    expect(html).toContain('Waiting for confirmation');
    expect(html).toContain('Scanned');
  });
});
