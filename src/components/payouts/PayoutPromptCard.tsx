import { useRouter } from 'expo-router';
import { Landmark } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import { shouldShowPayoutPrompt } from '@/features/payouts/banks';
import { useMyPayouts } from '@/features/payouts/queries';
import { usePreferences } from '@/store/preferences.store';

/** Nudges people to add where they'd like to be paid back, so friends can transfer straight away. */
export function PayoutPromptCard() {
  const colors = useColors();
  const router = useRouter();
  const mine = useMyPayouts();
  const dismissedAt = usePreferences((s) => s.payoutPromptDismissedAt);
  const dismiss = usePreferences((s) => s.dismissPayoutPrompt);
  if (!mine.data) return null;
  const hasAccount = !!mine.data.default || mine.data.groups.some((g) => g.account);
  if (!shouldShowPayoutPrompt(hasAccount, dismissedAt)) return null;

  return (
    <Surface className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
          <Landmark size={18} color={colors.ink} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <Text variant="bodyStrong">Get paid back faster</Text>
          <Text variant="caption" tone="muted">
            Add your bank account so people in your taabs can transfer what they owe you from their own bank.
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button label="Not now" size="md" variant="secondary" className="flex-1" onPress={dismiss} />
        <Button label="Add account" size="md" className="flex-1" onPress={() => router.push('/settings/payout')} />
      </View>
    </Surface>
  );
}
