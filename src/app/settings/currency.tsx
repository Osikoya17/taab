import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CURRENCIES, SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { useProfile, useUpdateProfile } from '@/features/profile/queries';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast.store';

export default function CurrencyScreen() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();

  return (
    <Screen header={<AppHeader back title="Currency" />}>
      <Text variant="body" tone="muted" className="pt-2">
        New taabs start in your default currency. Existing taabs keep their own.
      </Text>
      <View className="mt-5 gap-2">
        {SUPPORTED_CURRENCIES.map((code) => (
          <ChoiceRow
            key={code}
            label={`${code} — ${CURRENCIES[code].name}`}
            detail={CURRENCIES[code].symbol}
            selected={profile?.defaultCurrency === code}
            onPress={() => {
              if (profile?.defaultCurrency === code) return;
              haptics.selection();
              update.mutate({ defaultCurrency: code }, { onError: () => toast.error('Couldn’t change currency') });
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
