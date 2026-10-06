import { balancesAfter, canExplainSettlement, directDebts, explainSettlement, positions } from './explain';

const bill = (payer: string, amount: number, shares: Record<string, number>) => ({
  paidBy: [{ userId: payer, amount }],
  splitBetween: Object.entries(shares).map(([userId, share]) => ({ userId, amount: share })),
});

describe('explaining simplified settlements', () => {
  it('only applies to taabs with more than two people', () => {
    expect([2, 3, 6].map(canExplainSettlement)).toEqual([false, true, true]);
  });

  it('turns three overlapping debts into two payments (the PRD example)', () => {
    const expenses = [
      bill('gbayin', 20_000, { ranmi: 20_000 }),
      bill('macky', 15_000, { gbayin: 15_000 }),
      bill('ranmi', 5_000, { macky: 5_000 }),
    ];
    const result = explainSettlement(['ranmi', 'gbayin', 'macky'], expenses, []);
    expect(result.direct).toEqual([
      { fromUserId: 'ranmi', toUserId: 'gbayin', amount: 20_000 },
      { fromUserId: 'gbayin', toUserId: 'macky', amount: 15_000 },
      { fromUserId: 'macky', toUserId: 'ranmi', amount: 5_000 },
    ]);
    expect(Object.fromEntries(result.positions.map((p) => [p.userId, p.net]))).toEqual({ ranmi: -15_000, gbayin: 5_000, macky: 10_000 });
    expect(result.simplified).toEqual([
      { fromUserId: 'ranmi', toUserId: 'macky', amount: 10_000 },
      { fromUserId: 'ranmi', toUserId: 'gbayin', amount: 5_000 },
    ]);
  });

  it('nets debts between the same two people across bills', () => {
    const direct = directDebts([bill('a', 3_000, { a: 1_000, b: 2_000 }), bill('b', 1_500, { a: 1_500 })], []);
    expect(direct).toEqual([{ fromUserId: 'b', toUserId: 'a', amount: 500 }]);
  });

  it('splits a bill with two payers without losing a kobo', () => {
    const expense = {
      paidBy: [{ userId: 'a', amount: 7_001 }, { userId: 'b', amount: 2_999 }],
      splitBetween: [{ userId: 'a', amount: 2_500 }, { userId: 'b', amount: 2_500 }, { userId: 'c', amount: 2_500 }, { userId: 'd', amount: 2_500 }],
    };
    const direct = directDebts([expense], []);
    const owedTo = (id: string) => direct.filter((t) => t.toUserId === id).reduce((s, t) => s + t.amount, 0);
    expect(owedTo('a')).toBe(4_501);
    expect(owedTo('b')).toBe(499);
  });

  it('counts confirmed payments in both the direct debts and the positions', () => {
    const expenses = [bill('a', 9_000, { a: 3_000, b: 3_000, c: 3_000 })];
    const paid = [{ fromUserId: 'b', toUserId: 'a', amount: 3_000 }];
    expect(directDebts(expenses, paid)).toEqual([{ fromUserId: 'c', toUserId: 'a', amount: 3_000 }]);
    const b = positions(['a', 'b', 'c'], expenses, paid).find((p) => p.userId === 'b')!;
    expect(b).toEqual({ userId: 'b', paid: 0, share: 3_000, sent: 3_000, received: 0, net: 0 });
  });

  it('direct and simplified payments always leave everyone at zero', () => {
    const expenses = [
      bill('a', 12_000, { a: 3_000, b: 3_000, c: 3_000, d: 3_000 }),
      bill('b', 8_000, { a: 2_000, b: 2_000, c: 2_000, d: 2_000 }),
      bill('c', 4_000, { b: 2_000, d: 2_000 }),
    ];
    const payments = [{ fromUserId: 'd', toUserId: 'a', amount: 1_000 }];
    const result = explainSettlement(['a', 'b', 'c', 'd'], expenses, payments);
    for (const plan of [result.direct, result.simplified]) {
      for (const amount of balancesAfter(result.positions, plan).values()) expect(amount).toBe(0);
    }
    expect(result.simplified.length).toBeLessThanOrEqual(result.direct.length);
  });
});
