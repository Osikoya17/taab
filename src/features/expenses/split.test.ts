import {
  allocateProportionally,
  basisPointsToPercentString,
  computeSplit,
  expenseNetByUser,
  percentToBasisPoints,
  resolvePayers,
} from './split';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

it('rejects duplicate participants and negative payer amounts', () => {
  expect(computeSplit(100, 'equal', [{ userId: 'a' }, { userId: 'a' }]).ok).toBe(false);
  expect(resolvePayers(100, ['a', 'b'], { a: -100, b: 200 }).ok).toBe(false);
  expect(resolvePayers(100, ['a', 'a']).ok).toBe(false);
});
it('preserves integer totals even when the sum of share weights exceeds safe integers', () => {
  const values = allocateProportionally(1001, [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
  expect(values).toEqual([501, 500]);
});
const amounts = (result: ReturnType<typeof computeSplit>) => (result.ok ? result.splits.map((s) => s.amount) : null);

describe('allocateProportionally', () => {
  it('always sums exactly to the total', () => {
    for (const total of [1, 7, 100, 999_999, 4_800_000]) {
      for (const weights of [[1, 1, 1], [2, 1, 1], [3333, 3333, 3334], [1, 0, 5]]) {
        expect(sum(allocateProportionally(total, weights))).toBe(total);
      }
    }
  });

  it('gives leftover minor units to the earliest participants on ties', () => {
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportionally(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it('handles amounts beyond float precision', () => {
    const total = Number.MAX_SAFE_INTEGER - 1;
    expect(sum(allocateProportionally(total, [7, 3]))).toBe(total);
  });
});

describe('computeSplit — equal', () => {
  it('splits Dinner at Nok between four people', () => {
    const result = computeSplit(4_800_000, 'equal', [
      { userId: 'ranmi' },
      { userId: 'gbayin' },
      { userId: 'macky' },
      { userId: 'dami' },
    ]);
    expect(amounts(result)).toEqual([1_200_000, 1_200_000, 1_200_000, 1_200_000]);
  });

  it('rounds without losing a kobo', () => {
    const result = computeSplit(1_000, 'equal', [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]);
    expect(amounts(result)).toEqual([334, 333, 333]);
  });

  it('rejects empty participants and bad totals', () => {
    expect(computeSplit(100, 'equal', [])).toEqual({ ok: false, error: { code: 'no_participants' } });
    expect(computeSplit(0, 'equal', [{ userId: 'a' }])).toEqual({ ok: false, error: { code: 'invalid_total' } });
    expect(computeSplit(10.5, 'equal', [{ userId: 'a' }])).toEqual({ ok: false, error: { code: 'invalid_total' } });
  });
});

describe('computeSplit — exact', () => {
  it('accepts uneven amounts that add up', () => {
    const result = computeSplit(950_000, 'exact', [
      { userId: 'a', value: 500_000 },
      { userId: 'b', value: 450_000 },
    ]);
    expect(amounts(result)).toEqual([500_000, 450_000]);
  });

  it('reports how far off the amounts are', () => {
    const result = computeSplit(950_000, 'exact', [
      { userId: 'a', value: 500_000 },
      { userId: 'b', value: 400_000 },
    ]);
    expect(result).toEqual({ ok: false, error: { code: 'exact_mismatch', difference: 50_000 } });
  });

  it('rejects negative or fractional values', () => {
    expect(computeSplit(100, 'exact', [{ userId: 'a', value: -1 }]).ok).toBe(false);
    expect(computeSplit(100, 'exact', [{ userId: 'a', value: 0.5 }]).ok).toBe(false);
  });
});

describe('computeSplit — percentage', () => {
  it('requires exactly 100%', () => {
    const result = computeSplit(700_000, 'percentage', [
      { userId: 'a', value: 5000 },
      { userId: 'b', value: 4000 },
    ]);
    expect(result).toEqual({ ok: false, error: { code: 'percentage_mismatch', differenceBp: 1000 } });
  });

  it('splits by thirds without drift', () => {
    const result = computeSplit(10_000, 'percentage', [
      { userId: 'a', value: 3333 },
      { userId: 'b', value: 3333 },
      { userId: 'c', value: 3334 },
    ]);
    const values = amounts(result)!;
    expect(sum(values)).toBe(10_000);
    expect(values).toEqual([3333, 3333, 3334]);
  });
});

describe('computeSplit — shares', () => {
  it('splits You = 2, Gbayin = 1, Macky P = 1', () => {
    const result = computeSplit(4_800_000, 'shares', [
      { userId: 'ranmi', value: 2 },
      { userId: 'gbayin', value: 1 },
      { userId: 'macky', value: 1 },
    ]);
    expect(amounts(result)).toEqual([2_400_000, 1_200_000, 1_200_000]);
  });

  it('allows zero shares for some people but not all', () => {
    expect(amounts(computeSplit(900, 'shares', [{ userId: 'a', value: 1 }, { userId: 'b', value: 0 }]))).toEqual([900, 0]);
    expect(computeSplit(900, 'shares', [{ userId: 'a', value: 0 }])).toEqual({ ok: false, error: { code: 'no_shares' } });
  });
});

describe('resolvePayers', () => {
  it('defaults a single payer to the full amount', () => {
    expect(resolvePayers(4_800_000, ['ranmi'])).toEqual({ ok: true, payers: [{ userId: 'ranmi', amount: 4_800_000 }] });
  });

  it('divides equally between multiple payers', () => {
    expect(resolvePayers(1_001, ['a', 'b'])).toEqual({
      ok: true,
      payers: [
        { userId: 'a', amount: 501 },
        { userId: 'b', amount: 500 },
      ],
    });
  });

  it('validates explicit multi-payer amounts', () => {
    expect(resolvePayers(1_000, ['a', 'b'], { a: 600, b: 300 })).toEqual({
      ok: false,
      error: { code: 'payers_mismatch', difference: 100 },
    });
    expect(resolvePayers(1_000, ['a', 'b'], { a: 600, b: 400 }).ok).toBe(true);
  });

  it('requires at least one payer', () => {
    expect(resolvePayers(1_000, [])).toEqual({ ok: false, error: { code: 'no_payers' } });
  });
});

describe('expenseNetByUser', () => {
  it('nets multiple payers against their own shares', () => {
    const net = expenseNetByUser({
      paidBy: [
        { userId: 'a', amount: 6_000 },
        { userId: 'b', amount: 3_000 },
      ],
      splitBetween: [
        { userId: 'a', amount: 3_000 },
        { userId: 'b', amount: 3_000 },
        { userId: 'c', amount: 3_000 },
      ],
    });
    expect(Object.fromEntries(net)).toEqual({ a: 3_000, b: 0, c: -3_000 });
    expect(sum([...net.values()])).toBe(0);
  });
});

describe('percentage parsing', () => {
  it('converts to and from basis points', () => {
    expect(percentToBasisPoints('33.33')).toBe(3333);
    expect(percentToBasisPoints('50')).toBe(5000);
    expect(percentToBasisPoints('12.5')).toBe(1250);
    expect(percentToBasisPoints('101')).toBeNull();
    expect(percentToBasisPoints('1.234')).toBeNull();
    expect(basisPointsToPercentString(3333)).toBe('33.33');
    expect(basisPointsToPercentString(1250)).toBe('12.5');
    expect(basisPointsToPercentString(5000)).toBe('50');
  });
});
