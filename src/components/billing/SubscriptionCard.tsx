import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import type { SubscriptionState } from '@/features/billing/types';
import { shortDate } from '@/utils/dates';

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

/** Compact taab+ entry point for Profile. */
export function SubscriptionCard({ subscription, isPlus, onPress }: { subscription: SubscriptionState; isPlus: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={isPlus ? 'Manage taab+' : 'Get taab+'}
      className="flex-row items-center gap-4 overflow-hidden rounded-card bg-ink px-4 py-4">
      <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <Text variant="bodyStrong" tone="inverse">
          +
        </Text>
      </View>
      <View className="flex-1">
        <Text variant="bodyStrong" tone="inverse">
          {isPlus ? 'You’re on taab+' : 'Do more with taab+'}
        </Text>
        <Text variant="caption" className="mt-0.5" style={{ color: '#BDBDB8' }} numberOfLines={2}>
          {subscriptionStatusCopy(subscription, isPlus)}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.faint} />
    </PressableScale>
  );
}
