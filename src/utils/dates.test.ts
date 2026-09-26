import { dayLabel, relativeTime, timelineBucket, updatedAgo } from './dates';

// Saturday 26 September 2026, 15:00 local time.
const NOW = new Date(2026, 8, 26, 15, 0, 0);
const at = (days: number, hours = 0, minutes = 0) =>
  new Date(NOW.getTime() - ((days * 24 + hours) * 60 + minutes) * 60_000).toISOString();

describe('relativeTime', () => {
  it('uses compact units for recent events', () => {
    expect(relativeTime(at(0, 0, 0), NOW)).toBe('now');
    expect(relativeTime(at(0, 0, 10), NOW)).toBe('10m');
    expect(relativeTime(at(0, 2), NOW)).toBe('2h');
  });

  it('uses day names within a week, then dates', () => {
    expect(relativeTime(at(1), NOW)).toBe('Yesterday');
    expect(relativeTime(at(2), NOW)).toBe('Thursday');
    expect(relativeTime(at(6), NOW)).toBe('Sunday');
    expect(relativeTime(at(6, 20), NOW)).toBe('19 Sep');
  });
});

describe('timelineBucket', () => {
  it('groups by Today, Yesterday, Earlier this week, then month', () => {
    expect(timelineBucket(at(0, 3), NOW)).toBe('Today');
    expect(timelineBucket(at(1), NOW)).toBe('Yesterday');
    expect(timelineBucket(at(4), NOW)).toBe('Earlier this week');
    expect(timelineBucket(at(10), NOW)).toBe('September');
    expect(timelineBucket(at(40), NOW)).toBe('August');
    expect(timelineBucket(new Date(2025, 11, 20).toISOString(), NOW)).toBe('December 2025');
  });
});

describe('labels', () => {
  it('labels expense days', () => {
    expect(dayLabel(at(0, 1), NOW)).toBe('Today');
    expect(dayLabel(at(1), NOW)).toBe('Yesterday');
    expect(dayLabel(at(3), NOW)).toBe('Wednesday');
  });

  it('writes updated copy', () => {
    expect(updatedAgo(at(0, 2), NOW)).toBe('Updated 2h ago');
    expect(updatedAgo(at(1), NOW)).toBe('Updated yesterday');
  });
});
