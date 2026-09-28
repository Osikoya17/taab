import { Check, ChevronRight, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { FEATURES, PLUS_BENEFITS, PLUS_MONTHLY, PLUS_PRICES, PLUS_YEARLY, type FeatureKey } from '@/features/billing/products';
import type { SubscriptionState } from '@/features/billing/types';
import { shortDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

/** Text on the ink card: bright enough to read, quieter than the title. */
const ON_INK_MUTED = '#BDBDB8';
const ON_INK_SOFT = 'rgba(255,255,255,0.08)';

/** Pill-length names for the card; the taab+ screen uses the full titles. */
const PERK_LABELS: Partial<Record<FeatureKey, string>> = {
  [FEATURES.unlimitedGroups]: 'Unlimited',
  [FEATURES.advancedSplits]: '% & shares',
  [FEATURES.recurringExpenses]: 'Recurring',
};

export function subscriptionStatusCopy(subscription: SubscriptionState, isPlus: boolean): string {
  const end = subscription.currentPeriodEnd ? shortDate(subscription.currentPeriodEnd) : undefined;
  switch (subscription.status) {
    case 'trialing':
      return end ? `Free trial until ${end}` : 'Free trial';
    case 'active':
      return end ? `Renews ${end}` : 'Active';
    case 'canceled':
      return isPlus && end ? `Cancelled — active until ${end}` : 'Cancelled';
    case 'past_due':
      return 'Payment failed — update your payment method';
    case 'expired':
      return 'Expired — renew to get taab+ back';
    case 'none':
      return 'Unlimited taabs, recurring bills and more';
  }
}

/** "From ₦1,500 a month · 7-day free trial" — the honest price, up front. */
function priceLine(): string {
  const monthly = PLUS_PRICES[PLUS_MONTHLY];
  const trial = PLUS_PRICES[PLUS_YEARLY].trialDays;
  const from = `From ${formatMoney(monthly.amount, monthly.currency)} a month`;
  return trial ? `${from} · ${trial}-day free trial` : from;
}

/** The ochre tile: a drawn plus, taab+'s only mark. */
function PlusMark() {
  return (
    <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.accent }}>
      <Plus size={24} color={colors.ink} strokeWidth={2.75} />
    </View>
  );
}

/** Compact taab+ entry point for Profile. */
export function SubscriptionCard({ subscription, isPlus, onPress }: { subscription: SubscriptionState; isPlus: boolean; onPress: () => void }) {
  const showPitch = !isPlus && subscription.status === 'none';
  const perks = PLUS_BENEFITS.filter((b) => b.available).slice(0, 3);

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={isPlus ? 'Manage taab+' : 'Get taab+'}
      className="overflow-hidden rounded-card bg-ink p-4">
      <View className="flex-row items-center gap-4">
        <PlusMark />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text variant="subheading" tone="inverse" numberOfLines={1} className="shrink">
              {isPlus ? 'You’re on taab' : 'Do more with taab'}
              <Text variant="subheading" style={{ color: colors.accent }}>
                +
              </Text>
            </Text>
            {isPlus ? (
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.accentSoft }}>
                <Text variant="micro" style={{ color: colors.ink }}>
                  Active
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" className="mt-0.5" style={{ color: ON_INK_MUTED }} numberOfLines={2}>
            {showPitch ? priceLine() : subscriptionStatusCopy(subscription, isPlus)}
          </Text>
        </View>
        <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: ON_INK_SOFT }}>
          <ChevronRight size={16} color={colors.canvas} strokeWidth={2.2} />
        </View>
      </View>

      {showPitch ? (
        // One row of equal-width perks, so they sit side by side at any width.
        <View className="mt-4 flex-row gap-2 border-t pt-4" style={{ borderTopColor: ON_INK_SOFT }}>
          {perks.map((perk) => (
            <View key={perk.feature} className="flex-1 flex-row items-center justify-center gap-1 rounded-full px-2 py-1.5" style={{ backgroundColor: ON_INK_SOFT }}>
              <Check size={12} color={colors.accent} strokeWidth={3} />
              <Text variant="micro" style={{ color: colors.line }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {PERK_LABELS[perk.feature] ?? perk.title}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </PressableScale>
  );
}
