import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { useAuthActions, useAuthSession } from '@/features/auth/auth-context';
import { useGroups } from '@/features/groups/queries';
import { queryKeys } from '@/lib/query-keys';
import { billingService } from '@/services/billing.service';
import { hasRemoteApi } from '@/services/api/client';

import { hasPlusAccess } from './access';
import { CLERK_PLUS_PLAN_SLUG, FEATURES, FREE_LIMITS, type FeatureKey, type PaidPlanId } from './products';
import { FREE_SUBSCRIPTION, type SubscriptionStatus } from './types';

export function useSubscription() {
  const { isSignedIn } = useAuthSession();
  return useQuery({ queryKey: queryKeys.subscription, queryFn: () => billingService.getSubscription(), enabled: isSignedIn });
}

/**
 * Live access follows the backend subscription record, including expiry dates.
 * The device demo can simulate subscription lifecycle states without charging.
 *
 * This only shapes the interface. The backend re-checks every protected
 * operation — never rely on it for security.
 */
export function useEntitlements() {
  const { data: subscription = FREE_SUBSCRIPTION, isLoading } = useSubscription();
  const actions = useAuthActions();

  const clerkPlus = actions.hasEntitlement({ plan: CLERK_PLUS_PLAN_SLUG });
  const isPlus = hasRemoteApi ? hasPlusAccess(subscription) : clerkPlus || hasPlusAccess(subscription);

  function can(feature: FeatureKey): boolean {
    return isPlus || (!hasRemoteApi && actions.hasEntitlement({ feature }));
  }

  return {
    isLoading,
    isPlus,
    subscription,
    status: subscription.status as SubscriptionStatus,
    can,
    limits: FREE_LIMITS,
  };
}

/** Whether the user can create another group on their plan. */
export function useCanCreateGroup() {
  const { can } = useEntitlements();
  const { data: groups } = useGroups();
  const count = groups?.length ?? 0;
  return can(FEATURES.unlimitedGroups) || count < FREE_LIMITS.activeGroups;
}

/**
 * Runs `action` when the feature is unlocked, otherwise opens taab+ with the
 * feature highlighted. Use this instead of ad-hoc plan checks.
 */
export function usePremiumGate() {
  const { can } = useEntitlements();
  const router = useRouter();
  return function guard(feature: FeatureKey, action: () => void) {
    if (can(feature)) action();
    else router.push({ pathname: '/subscription', params: { feature } });
  };
}

export function useCheckout() {
  const client = useQueryClient();
  const actions = useAuthActions();
  return useMutation({
    mutationFn: async (plan: PaidPlanId) => {
      const result = await billingService.startCheckout(plan);
      if (result.kind === 'redirect') await WebBrowser.openAuthSessionAsync(result.url);
      await actions.refreshSession();
      return billingService.getSubscription();
    },
    onSuccess: (subscription) => { client.setQueryData(queryKeys.subscription, subscription); return client.invalidateQueries(); },
  });
}

export function useRestorePurchases() {
  const client = useQueryClient();
  const actions = useAuthActions();
  return useMutation({
    mutationFn: async () => {
      await actions.refreshSession();
      return billingService.restorePurchases();
    },
    onSuccess: (subscription) => { client.setQueryData(queryKeys.subscription, subscription); return client.invalidateQueries(); },
  });
}

export function useSubscriptionAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: { type: 'cancel' } | { type: 'resume' } | { type: 'simulate'; status: SubscriptionStatus }) =>
      action.type === 'cancel'
        ? billingService.cancel()
        : action.type === 'resume'
          ? billingService.resume()
          : billingService.simulateStatus(action.status),
    onSuccess: (subscription) => { client.setQueryData(queryKeys.subscription, subscription); return client.invalidateQueries(); },
  });
}
