import { hasPlusAccess } from './access';
import type { SubscriptionState } from './types';

const base: SubscriptionState = { plan: 'plus_monthly', status: 'active', updatedAt: '2026-09-01T00:00:00.000Z' };
const NOW = Date.parse('2026-09-26T12:00:00.000Z');

describe('hasPlusAccess', () => {
  it('grants access while subscribed, trialing, or in a payment grace period', () => {
    expect(hasPlusAccess({ ...base, status: 'active' }, NOW)).toBe(true);
    expect(hasPlusAccess({ ...base, status: 'trialing', trialEndsAt: '2026-10-01T00:00:00.000Z' }, NOW)).toBe(true);
    expect(hasPlusAccess({ ...base, status: 'past_due', graceEndsAt: '2026-10-01T00:00:00.000Z' }, NOW)).toBe(true);
  });
  it('expires trials and grace periods without waiting for a background refresh', () => {
    expect(hasPlusAccess({ ...base, status: 'trialing', trialEndsAt: '2026-09-20T00:00:00.000Z' }, NOW)).toBe(false);
    expect(hasPlusAccess({ ...base, status: 'past_due' }, NOW)).toBe(false);
    expect(hasPlusAccess({ ...base, status: 'past_due', graceEndsAt: '2026-09-20T00:00:00.000Z' }, NOW)).toBe(false);
  });

  it('keeps cancelled plans active until the period ends', () => {
    expect(hasPlusAccess({ ...base, status: 'canceled', currentPeriodEnd: '2026-10-01T00:00:00.000Z' }, NOW)).toBe(true);
    expect(hasPlusAccess({ ...base, status: 'canceled', currentPeriodEnd: '2026-09-20T00:00:00.000Z' }, NOW)).toBe(false);
  });

  it('denies expired, unsubscribed and free', () => {
    expect(hasPlusAccess({ ...base, status: 'expired' }, NOW)).toBe(false);
    expect(hasPlusAccess({ ...base, status: 'none' }, NOW)).toBe(false);
    expect(hasPlusAccess({ ...base, plan: 'free' }, NOW)).toBe(false);
  });
});
