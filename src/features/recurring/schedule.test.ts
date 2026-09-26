import { nextOccurrence } from './schedule';

describe('recurring schedule', () => {
  it('clamps January 31 to February then restores the anchored day in March', () => {
    const february = nextOccurrence('2026-01-31T10:00:00.000Z', 'monthly');
    expect(february).toBe('2026-02-28T10:00:00.000Z');
    expect(nextOccurrence(february, 'monthly', 30, 31)).toBe('2026-03-31T10:00:00.000Z');
  });
  it('handles leap years and year rollover', () => {
    expect(nextOccurrence('2028-01-31T10:00:00.000Z', 'monthly')).toBe('2028-02-29T10:00:00.000Z');
    expect(nextOccurrence('2026-12-31T10:00:00.000Z', 'monthly')).toBe('2027-01-31T10:00:00.000Z');
  });
  it('supports weekly and custom schedules without accepting invalid intervals', () => {
    expect(nextOccurrence('2026-09-26T10:00:00.000Z', 'weekly')).toBe('2026-10-03T10:00:00.000Z');
    expect(nextOccurrence('2026-09-26T10:00:00.000Z', 'custom', 10)).toBe('2026-10-06T10:00:00.000Z');
    expect(() => nextOccurrence('invalid', 'monthly')).toThrow();
    expect(() => nextOccurrence('2026-09-26T10:00:00.000Z', 'custom', -1)).toThrow();
  });
});
