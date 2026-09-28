import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CURRENCIES, SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { useDisplayCurrency } from '@/features/currency/display';
import { formatRate, rateBetween } from '@/features/currency/rates';
import { useProfile, useUpdateProfile } from '@/features/profile/queries';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast.store';

export default function CurrencyScreen() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { display, setDisplay, rates, ratesUnavailable } = useDisplayCurrency();

  return (
    <Screen header={<AppHeader back title="Currency" />}>
      <Text variant="subheading" className="pt-2">
        Show amounts in
      </Text>
      <Text variant="body" tone="muted" className="mt-1">
        Every amount in taab is shown in this currency at today’s rates. What people owe each other doesn’t change.
      </Text>
      <View className="mt-4 gap-2">
        <ChoiceRow
          label="Each taab’s own currency"
          detail="No conversion"
          selected={display === null}
          onPress={() => {
            if (display === null) return;
            haptics.selection();
            setDisplay(null);
          }}
        />
        {SUPPORTED_CURRENCIES.map((code) => (
          <ChoiceRow
            key={code}
            label={`${code} — ${CURRENCIES[code].name}`}
            detail={rates && code !== 'USD' ? formatRate(rateBetween('USD', code, rates), 'USD', code) : CURRENCIES[code].symbol}
            selected={display === code}
            onPress={() => {
              if (display === code) return;
              haptics.selection();
              setDisplay(code);
            }}
          />
        ))}
      </View>
      {ratesUnavailable ? (
        <Text variant="caption" tone="muted" className="mt-2">
          Couldn’t get today’s exchange rates. Amounts show in each taab’s own currency until they load.
        </Text>
      ) : null}

      <Text variant="subheading" className="mt-8">
        Default for new taabs
      </Text>
      <Text variant="body" tone="muted" className="mt-1">
        New taabs start in this currency. Existing taabs keep their own.
      </Text>
      <View className="mt-4 gap-2">
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
