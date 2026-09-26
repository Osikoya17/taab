import { createClerkClient, verifyToken } from '@clerk/backend';

import { FREE_SUBSCRIPTION, type SubscriptionState } from '../src/features/billing/types';
import { ServiceError } from '../src/services/api/errors';
import type { ApiOptions } from './api';

export function clerkServices(secretKey: string, authorizedParties: string[]): Pick<ApiOptions, 'authenticate' | 'getSubscription' | 'deleteIdentity'> {
  const clerk = createClerkClient({ secretKey });
  return {
    async authenticate(request) {
      const match = request.headers.authorization?.match(/^Bearer (\S+)$/);
      if (!match) throw new ServiceError('forbidden');
      try {
        const claims = await verifyToken(match[1], { secretKey, authorizedParties });
        if (!claims.sub || typeof claims.sid !== 'string') throw new ServiceError('forbidden');
        const user = await clerk.users.getUser(claims.sub);
        if (user.banned || user.locked) throw new ServiceError('forbidden');
        const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId && e.verification?.status === 'verified')?.emailAddress;
        if (!email) throw new ServiceError('forbidden');
        return { userId: user.id, email, name: [user.firstName, user.lastName].filter(Boolean).join(' ') || email.split('@')[0], avatarUrl: user.imageUrl, createdAt: new Date(user.createdAt).toISOString() };
      } catch {
        throw new ServiceError('forbidden');
      }
    },
    async getSubscription(userId): Promise<SubscriptionState> {
      if (process.env.CLERK_BILLING_ENABLED !== 'true') return FREE_SUBSCRIPTION;
      try {
        const subscription = await clerk.billing.getUserBillingSubscription(userId);
        const item = subscription.subscriptionItems
          .filter((entry) => entry.plan?.slug === 'plus')
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (!item) return FREE_SUBSCRIPTION;
        const status = item.status === 'active' ? item.isFreeTrial ? 'trialing' : 'active'
          : item.status === 'past_due' ? 'past_due' : item.status === 'canceled' ? 'canceled' : 'expired';
        return {
          plan: item.planPeriod === 'annual' ? 'plus_yearly' : 'plus_monthly', status, source: 'clerk',
          currentPeriodEnd: item.periodEnd ? new Date(item.periodEnd).toISOString() : undefined,
          trialEndsAt: item.isFreeTrial && item.periodEnd ? new Date(item.periodEnd).toISOString() : undefined,
          graceEndsAt: item.pastDueAt ? new Date(item.pastDueAt + 7 * 86400_000).toISOString() : undefined,
          updatedAt: new Date(item.updatedAt).toISOString(),
        };
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) return FREE_SUBSCRIPTION;
        throw new ServiceError('unavailable');
      }
    },
    async deleteIdentity(userId) {
      try { await clerk.users.deleteUser(userId); }
      catch (error) {
        if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) throw error;
      }
    },
  };
}
