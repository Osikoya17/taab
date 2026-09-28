import { useLocalSearchParams } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { PlanOption } from '@/components/billing/PlanOption';
import { subscriptionStatusCopy } from '@/components/billing/SubscriptionCard';
import { SheetHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useAuthSession } from '@/features/auth/auth-context';
import { PLUS_BENEFITS, PLUS_MONTHLY, PLUS_PRICES, PLUS_YEARLY, yearlySavingsPercent, type PaidPlanId } from '@/features/billing/products';
import type { SubscriptionStatus } from '@/features/billing/types';
import { useCheckout, useEntitlements, useRestorePurchases, useSubscriptionAction } from '@/features/billing/use-entitlements';
import { haptics } from '@/lib/haptics';
import { captureEvent } from '@/lib/posthog';
import { hasPlusAccess } from '@/features/billing/access';
import { hasRemoteApi } from '@/services/api/client';
import { toast } from '@/store/toast.store';
import { useGoBack } from '@/hooks/use-go-back';

const DEMO_STATES: SubscriptionStatus[] = ['none', 'trialing', 'active', 'canceled', 'past_due', 'expired'];

export default function SubscriptionScreen() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const goBack = useGoBack();
  const { mode } = useAuthSession();
  const { isPlus, subscription, status } = useEntitlements();
  const checkout = useCheckout();
  const restore = useRestorePurchases();
  const action = useSubscriptionAction();
  const [plan, setPlan] = useState<PaidPlanId>(PLUS_YEARLY);

  const savings = yearlySavingsPercent();
  const highlighted = PLUS_BENEFITS.find((b) => b.feature === feature);
  const selected = PLUS_PRICES[plan];
  const offersTrial = !!selected.trialDays && !subscription.trialEndsAt;

  async function subscribe() {
    try {
      const updated = await checkout.mutateAsync(plan);
      if (!hasPlusAccess(updated)) { toast.show('Subscription not activated', 'Your plan has not changed.'); return; }
      captureEvent('subscription_started', {
        plan,
        trial_offered: offersTrial,
      });
      haptics.success();
      toast.success('Welcome to taab+', offersTrial ? `Your ${selected.trialDays}-day trial has started.` : undefined);
      goBack('/profile');
    } catch {
      toast.error('Checkout didn’t finish', 'Check your subscription status before trying again.');
    }
  }

  async function restorePurchases() {
    try {
      const restored = await restore.mutateAsync();
      if (restored.plan !== 'free') {
        captureEvent('subscription_restored', { plan: restored.plan });
      }
      toast.show(restored.plan === 'free' ? 'No purchases to restore' : 'taab+ restored');
    } catch {
      toast.error('Couldn’t restore right now', 'Check your connection and try again.');
    }
  }

  const managing = isPlus || status === 'past_due';

  return (
    <Screen
      safeTop={false}
      header={<SheetHeader title="taab+" cancelLabel="Close" onCancel={() => goBack('/profile')} />}
      footer={
        managing ? undefined : (
          <View className="gap-2">
            {hasRemoteApi ? <Text variant="caption" tone="muted" className="text-center">New subscriptions aren’t available yet.</Text> : <Button label={offersTrial ? `Start ${selected.trialDays}-day free trial` : `Continue with ${selected.label}`} onPress={subscribe} loading={checkout.isPending} />}
            <PressableScale onPress={restorePurchases} accessibilityLabel="Restore purchases" className="items-center py-2">
              <Text variant="label" tone="muted">
                {restore.isPending ? 'Restoring…' : 'Restore purchases'}
              </Text>
            </PressableScale>
          </View>
        )
      }>
      <View className="pt-4">
        <Text variant="title">{managing ? 'Your taab+' : 'Do more with taab+'}</Text>
        <Text variant="body" tone="muted" className="mt-2">
          {managing
            ? subscriptionStatusCopy(subscription, isPlus)
            : highlighted
              ? `${highlighted.title} is part of taab+. Everything you use today stays free.`
              : 'Everything you use today stays free. taab+ is for groups that do a lot together.'}
        </Text>
      </View>

      {managing ? (
        <Surface className="mt-6 gap-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="bodyStrong">{subscription.plan === PLUS_YEARLY ? 'Yearly' : 'Monthly'} plan</Text>
              <Text variant="caption" tone="muted">
                {subscriptionStatusCopy(subscription, isPlus)}
              </Text>
            </View>
            <View className={status === 'past_due' ? 'rounded-full bg-negative-soft px-2.5 py-1' : 'rounded-full bg-positive-soft px-2.5 py-1'}>
              <Text variant="micro" tone={status === 'past_due' ? 'negative' : 'positive'}>
                {status === 'trialing' ? 'Trial' : status === 'canceled' ? 'Ending' : status === 'past_due' ? 'Action needed' : 'Active'}
              </Text>
            </View>
          </View>
          {hasRemoteApi ? <Text variant="caption" tone="muted">Manage renewals and payment details with the provider where you purchased your subscription.</Text> : status === 'past_due' ? (
            <Button label="Update payment method" onPress={subscribe} loading={checkout.isPending} />
          ) : status === 'canceled' ? (
            <Button label="Resume taab+" onPress={() => action.mutate({ type: 'resume' })} loading={action.isPending} />
          ) : (
            <Button label="Cancel subscription" variant="secondary" onPress={() => action.mutate({ type: 'cancel' }, { onSuccess: () => toast.show('taab+ won’t renew', 'You keep it until the end of this period.') })} loading={action.isPending} />
          )}
        </Surface>
      ) : (
        <View className="mt-6 flex-row gap-3">
          <PlanOption price={PLUS_PRICES[PLUS_MONTHLY]} selected={plan === PLUS_MONTHLY} onSelect={() => setPlan(PLUS_MONTHLY)} />
          <PlanOption
            price={PLUS_PRICES[PLUS_YEARLY]}
            selected={plan === PLUS_YEARLY}
            onSelect={() => setPlan(PLUS_YEARLY)}
            badge={savings > 0 ? `Save ${savings}%` : undefined}
          />
        </View>
      )}

      <View className="mt-7 gap-4">
        {PLUS_BENEFITS.map((b) => (
          <View key={b.feature} className="flex-row gap-3">
            <View className={b.available ? 'mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-ink' : 'mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-sunken'}>
              {b.available ? <Check size={13} color={colors.canvas} strokeWidth={3} /> : <Clock size={12} color={colors.muted} strokeWidth={2.2} />}
            </View>
            <View className="flex-1">
              <Text variant="bodyStrong">
                {b.title}
                {b.available ? '' : ' · soon'}
              </Text>
              <Text variant="caption" tone="muted">
                {b.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {!managing ? (
        <Text variant="caption" tone="faint" className="mt-7">
          {offersTrial ? `Free for ${selected.trialDays} days, then ` : ''}
          {selected.label.toLowerCase()} billing. Renews automatically until cancelled. Cancel any time in Profile → taab+.
        </Text>
      ) : null}

      {mode === 'demo' ? (
        <View className="mt-8 rounded-card border border-dashed border-line-strong p-4">
          <Text variant="label" tone="muted">
            Demo: simulate subscription state
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {DEMO_STATES.map((s) => (
              <Chip key={s} label={s.replace('_', ' ')} selected={status === s} onPress={() => action.mutate({ type: 'simulate', status: s })} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
