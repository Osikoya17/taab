import { computeSplit } from '@/features/expenses/split';
import type { Expense, ExpenseSplit, Settlement } from '@/types/models';

import {
  computeBalances,
  computeExpenseStatuses,
  simplifyDebts,
  summarizeForUser,
  totalOutstanding,
  type Balances,
} from './balances';

const MEMBERS = ['ranmi', 'gbayin', 'macky', 'dami'];

function equalSplit(total: number, ids: string[]): ExpenseSplit[] {
  const result = computeSplit(
    total,
    'equal',
    ids.map((userId) => ({ userId })),
  );
  if (!result.ok) throw new Error('bad split');
  return result.splits;
}

function expense(id: string, payer: string, total: number, ids = MEMBERS, date = `2026-09-0${id.length}`): Expense {
  return {
    id,
    groupId: 'flat-12',
    title: id,
    amount: total,
    currency: 'NGN',
    paidBy: [{ userId: payer, amount: total }],
    splitBetween: equalSplit(total, ids),
    splitMethod: 'equal',
    date,
    createdBy: payer,
    createdAt: date,
    updatedAt: date,
  };
}

function settlement(from: string, to: string, amount: number): Settlement {
  return {
    id: `${from}-${to}-${amount}`,
    groupId: 'flat-12',
    fromUserId: from,
    toUserId: to,
    amount,
    currency: 'NGN',
    createdBy: from,
    createdAt: '2026-09-10',
  };
}

const total = (balances: Balances) => [...balances.values()].reduce((a, b) => a + b, 0);

describe('computeBalances', () => {
  it('credits the payer and debits every share', () => {
    const balances = computeBalances(MEMBERS, [expense('dinner', 'ranmi', 4_800_000)], []);
    expect(Object.fromEntries(balances)).toEqual({
      ranmi: 3_600_000,
      gbayin: -1_200_000,
      macky: -1_200_000,
      dami: -1_200_000,
    });
    expect(total(balances)).toBe(0);
  });

  it('includes zero balances for members with no activity', () => {
    const balances = computeBalances([...MEMBERS, 'femi'], [], []);
    expect(balances.get('femi')).toBe(0);
    expect(totalOutstanding(balances)).toBe(0);
  });

  it('applies partial settlements', () => {
    const balances = computeBalances(
      MEMBERS,
      [expense('dinner', 'ranmi', 4_800_000)],
      [settlement('gbayin', 'ranmi', 500_000)],
    );
    expect(balances.get('gbayin')).toBe(-700_000);
    expect(balances.get('ranmi')).toBe(3_100_000);
    expect(total(balances)).toBe(0);
  });

  it('zeroes out after complete settlement', () => {
    const balances = computeBalances(
      MEMBERS,
      [expense('dinner', 'ranmi', 4_800_000)],
      [settlement('gbayin', 'ranmi', 1_200_000), settlement('macky', 'ranmi', 1_200_000), settlement('dami', 'ranmi', 1_200_000)],
    );
    expect([...balances.values()].every((v) => v === 0)).toBe(true);
    expect(simplifyDebts(balances)).toEqual([]);
  });
});

describe('simplifyDebts', () => {
  it('collapses a chain: A owes B, B owes C → A pays C', () => {
    const balances: Balances = new Map([
      ['a', -1_000],
      ['b', 0],
      ['c', 1_000],
    ]);
    expect(simplifyDebts(balances)).toEqual([{ fromUserId: 'a', toUserId: 'c', amount: 1_000 }]);
  });

  it('routes chains built from real expenses without touching the middle person', () => {
    // A owes B 1,000 (B paid for A), B owes C 1,000 (C paid for B).
    const expenses = [
      { paidBy: [{ userId: 'b', amount: 1_000 }], splitBetween: [{ userId: 'a', amount: 1_000 }] },
      { paidBy: [{ userId: 'c', amount: 1_000 }], splitBetween: [{ userId: 'b', amount: 1_000 }] },
    ];
    const balances = computeBalances(['a', 'b', 'c'], expenses, []);
    expect(simplifyDebts(balances)).toEqual([{ fromUserId: 'a', toUserId: 'c', amount: 1_000 }]);
  });

  it('settles everyone with at most n − 1 transfers', () => {
    const balances = computeBalances(
      MEMBERS,
      [
        expense('dinner', 'ranmi', 4_800_000),
        expense('uber', 'gbayin', 950_000),
        expense('netflix', 'macky', 700_000),
        expense('electricity', 'ranmi', 3_250_000),
      ],
      [],
    );
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(MEMBERS.length - 1);

    // Applying the transfers must leave every balance at exactly zero.
    const after = new Map(balances);
    for (const t of transfers) {
      after.set(t.fromUserId, (after.get(t.fromUserId) ?? 0) + t.amount);
      after.set(t.toUserId, (after.get(t.toUserId) ?? 0) - t.amount);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(transfers.every((t) => Number.isInteger(t.amount) && t.amount > 0)).toBe(true);
  });

  it('is deterministic on ties', () => {
    const balances: Balances = new Map([
      ['b', -500],
      ['a', -500],
      ['c', 1_000],
    ]);
    expect(simplifyDebts(balances)).toEqual([
      { fromUserId: 'a', toUserId: 'c', amount: 500 },
      { fromUserId: 'b', toUserId: 'c', amount: 500 },
    ]);
  });
});

describe('computeExpenseStatuses', () => {
  const dinner = expense('dinner', 'ranmi', 4_800_000, MEMBERS, '2026-09-01');
  const uber = expense('uber', 'ranmi', 900_000, ['ranmi', 'gbayin', 'macky'], '2026-09-02');

  it('marks everything unsettled before payments', () => {
    const balances = computeBalances(MEMBERS, [dinner, uber], []);
    const statuses = computeExpenseStatuses([dinner, uber], balances);
    expect(statuses.get('dinner')).toBe('unsettled');
    expect(statuses.get('uber')).toBe('unsettled');
  });

  it('pays off the oldest expense first', () => {
    const settlements = [settlement('gbayin', 'ranmi', 1_200_000), settlement('macky', 'ranmi', 1_200_000)];
    const balances = computeBalances(MEMBERS, [dinner, uber], settlements);
    const statuses = computeExpenseStatuses([dinner, uber], balances);
    // Dami has not paid for dinner yet, so it is only partly settled.
    expect(statuses.get('dinner')).toBe('partial');
    expect(statuses.get('uber')).toBe('unsettled');
  });

  it('marks expenses settled once everyone has paid', () => {
    const settlements = [
      settlement('gbayin', 'ranmi', 1_500_000),
      settlement('macky', 'ranmi', 1_500_000),
      settlement('dami', 'ranmi', 1_200_000),
    ];
    const balances = computeBalances(MEMBERS, [dinner, uber], settlements);
    const statuses = computeExpenseStatuses([dinner, uber], balances);
    expect(statuses.get('dinner')).toBe('settled');
    expect(statuses.get('uber')).toBe('settled');
  });

  it('treats an expense only the payer shares in as settled', () => {
    const solo = expense('solo', 'ranmi', 1_000, ['ranmi']);
    const statuses = computeExpenseStatuses([solo], computeBalances(MEMBERS, [solo], []));
    expect(statuses.get('solo')).toBe('settled');
  });
});

describe('summarizeForUser', () => {
  it('separates what you are owed from what you owe, per currency', () => {
    const summary = summarizeForUser('ranmi', [
      { currency: 'NGN', balances: new Map([['ranmi', 1_700_000]]) },
      { currency: 'NGN', balances: new Map([['ranmi', -420_000]]) },
      { currency: 'NGN', balances: new Map([['ranmi', 0]]) },
      { currency: 'USD', balances: new Map([['ranmi', 2_500]]) },
    ]);
    expect(summary.get('NGN')).toEqual({ owed: 1_700_000, owe: 420_000, net: 1_280_000 });
    expect(summary.get('USD')).toEqual({ owed: 2_500, owe: 0, net: 2_500 });
  });
});
