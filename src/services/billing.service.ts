import { PLUS_PRICES, type PaidPlanId } from '@/features/billing/products';
import { FREE_SUBSCRIPTION, type SubscriptionState, type SubscriptionStatus } from '@/features/billing/types';

import { hasRemoteApi, request } from './api/client';
import { read, write } from './mock/db';
import { requireSession } from './session';
import { ServiceError } from './api/errors';

/**
 * Billing boundary. The backend owns every secret: it creates checkout
 * sessions with Clerk Billing, receives webhooks, and is the source of truth
 * for entitlements. The app only opens checkout URLs and reads status.
 *
 * Store policy note: digital subscriptions sold inside iOS/Android apps must
 * use the platform's in-app purchase system. `startCheckout` returns either a
 * hosted checkout URL (web / where permitted) or, once a store provider is
 * wired in, a store product id — screens don't need to change.
 */
export type CheckoutResult =
  | { kind: 'activated'; subscription: SubscriptionState }
  | { kind: 'redirect'; url: string };

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function periodEndFor(plan: PaidPlanId) {
  return PLUS_PRICES[plan].interval === 'year' ? addDays(365) : addDays(30);
}

const mockBilling = {
  async getSubscription(): Promise<SubscriptionState> {
    const me = requireSession();
    return read((db) => db.subscriptions[me.userId] ?? FREE_SUBSCRIPTION);
  },

  async startCheckout(plan: PaidPlanId): Promise<CheckoutResult> {
    const me = requireSession();
    return write((db) => {
      const trialDays = PLUS_PRICES[plan].trialDays;
      const alreadyTrialed = !!db.subscriptions[me.userId]?.trialEndsAt;
      const trialing = !!trialDays && !alreadyTrialed;
      const subscription: SubscriptionState = {
        plan,
        status: trialing ? 'trialing' : 'active',
        trialEndsAt: trialing ? addDays(trialDays) : db.subscriptions[me.userId]?.trialEndsAt,
        currentPeriodEnd: trialing ? addDays(trialDays) : periodEndFor(plan),
        source: 'clerk',
        updatedAt: new Date().toISOString(),
      };
      db.subscriptions[me.userId] = subscription;
      return { kind: 'activated' as const, subscription };
    });
  },

  async cancel(): Promise<SubscriptionState> {
    const me = requireSession();
    return write((db) => {
      const current = db.subscriptions[me.userId] ?? FREE_SUBSCRIPTION;
      if (current.plan === 'free' || (current.status !== 'active' && current.status !== 'trialing' && current.status !== 'past_due')) throw new ServiceError('validation');
      const next: SubscriptionState = { ...current, status: 'canceled', updatedAt: new Date().toISOString() };
      db.subscriptions[me.userId] = next;
      return next;
    });
  },

  async resume(): Promise<SubscriptionState> {
    const me = requireSession();
    return write((db) => {
      const current = db.subscriptions[me.userId] ?? FREE_SUBSCRIPTION;
      if (current.status !== 'canceled' || !current.currentPeriodEnd || Date.parse(current.currentPeriodEnd) <= Date.now()) throw new ServiceError('validation');
      const next: SubscriptionState = { ...current, status: 'active', updatedAt: new Date().toISOString() };
      db.subscriptions[me.userId] = next;
      return next;
    });
  },

  /** Re-syncs with the store / billing provider. */
  async restorePurchases(): Promise<SubscriptionState> {
    return mockBilling.getSubscription();
  },

  /** Demo-only: lets testers walk through every lifecycle state. */
  async simulateStatus(status: SubscriptionStatus): Promise<SubscriptionState> {
    const me = requireSession();
    return write((db) => {
      const current = db.subscriptions[me.userId];
      const plan = status === 'none' ? 'free' : current && current.plan !== 'free' ? current.plan : 'plus_monthly';
      const next: SubscriptionState = {
        plan,
        status,
        trialEndsAt: status === 'trialing' ? addDays(7) : current?.trialEndsAt,
        graceEndsAt: status === 'past_due' ? addDays(7) : undefined,
        currentPeriodEnd: status === 'expired' ? addDays(-1) : status === 'none' ? undefined : addDays(status === 'trialing' ? 7 : 30),
        source: 'clerk',
        updatedAt: new Date().toISOString(),
      };
      db.subscriptions[me.userId] = next;
      return next;
    });
  },
};

const remoteBilling: typeof mockBilling = {
  getSubscription: () => request<SubscriptionState>('/billing/subscription'),
  startCheckout: (plan) => request<CheckoutResult>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  cancel: () => request<SubscriptionState>('/billing/cancel', { method: 'POST' }),
  resume: () => request<SubscriptionState>('/billing/resume', { method: 'POST' }),
  restorePurchases: () => request<SubscriptionState>('/billing/restore', { method: 'POST' }),
  simulateStatus: () => request<SubscriptionState>('/billing/subscription'),
};

export const billingService = hasRemoteApi ? remoteBilling : mockBilling;
