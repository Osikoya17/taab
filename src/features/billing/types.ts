import type { ISODateString } from '@/types/models';

import type { PlanId } from './products';

/**
 * Lifecycle of a taab+ subscription as reported by the backend.
 * - `trialing`: in a free trial, full access.
 * - `active`: paid and renewing.
 * - `canceled`: will not renew but keeps access until `currentPeriodEnd`.
 * - `past_due`: renewal payment failed; access continues during the grace period.
 * - `expired`: no access.
 * - `none`: never subscribed.
 */
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'canceled' | 'past_due' | 'expired';

export type SubscriptionState = {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd?: ISODateString;
  trialEndsAt?: ISODateString;
  graceEndsAt?: ISODateString;
  /** Where the purchase happened — informs which "manage" flow to open. */
  source?: 'clerk' | 'app_store' | 'play_store';
  updatedAt: ISODateString;
};

export const FREE_SUBSCRIPTION: SubscriptionState = {
  plan: 'free',
  status: 'none',
  updatedAt: new Date(0).toISOString(),
};
