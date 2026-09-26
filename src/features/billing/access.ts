import type { SubscriptionState } from './types';

/**
 * Whether a subscription currently grants taab+ features. Cancelled plans keep
 * access until the period ends; failed renewals keep access during the grace
 * period so a card hiccup never locks anyone out mid-trip.
 */
export function hasPlusAccess(subscription: SubscriptionState, now = Date.now()): boolean {
  if (subscription.plan === 'free') return false;
  switch (subscription.status) {
    case 'trialing':
      return !!subscription.trialEndsAt && Date.parse(subscription.trialEndsAt) > now;
    case 'active':
      return !subscription.currentPeriodEnd || Date.parse(subscription.currentPeriodEnd) > now;
    case 'past_due':
      return !!subscription.graceEndsAt && Date.parse(subscription.graceEndsAt) > now;
    case 'canceled':
      return !!subscription.currentPeriodEnd && Date.parse(subscription.currentPeriodEnd) > now;
    case 'expired':
    case 'none':
      return false;
  }
}
