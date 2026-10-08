import { Linking, Pressable, View } from 'react-native';

import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { CURRENCIES, SUPPORTED_CURRENCIES } from '@/constants/currencies';
import { RATES_ATTRIBUTION } from '@/features/currency/rates';
import type { Overview } from '@/features/groups/overview';
import { haptics } from '@/lib/haptics';
import type { CurrencyCode } from '@/types/models';
import { cx } from '@/utils/cx';
import { updatedAgo } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

/** "USD", "USD and GBP", "USD, GBP and EUR". */
function listCurrencies(codes: CurrencyCode[]): string {
  return codes.length <= 1 ? codes.join('') : `${codes.slice(0, -1).join(', ')} and ${codes.at(-1)}`;
}

/** ₦ $ £ € — tap one and every amount in the app is shown in it. */
function CurrencySwitcher({ selected, onSelect }: { selected: CurrencyCode; onSelect: (code: CurrencyCode) => void }) {
  return (
    <View className="flex-row gap-1 rounded-full border border-line bg-surface p-0.5" accessibilityRole="radiogroup" accessibilityLabel="Show amounts in">
      {SUPPORTED_CURRENCIES.map((code) => {
        const active = code === selected;
        return (
          <Pressable
            key={code}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onSelect(code);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`Show amounts in ${CURRENCIES[code].name}`}
            hitSlop={4}
            className={cx('h-7 min-w-[30px] items-center justify-center rounded-full px-2', active ? 'bg-ink' : undefined)}>
            <Text variant="label" tone={active ? 'inverse' : 'muted'}>
              {CURRENCIES[code].symbol}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type BalanceHeroProps = {
  overview: Overview;
  /** The currency highlighted in the switcher. */
  selectedCurrency: CurrencyCode;
  onSelectCurrency: (code: CurrencyCode) => void;
  /** A display currency is chosen but today's rates couldn't be fetched. */
  ratesUnavailable?: boolean;
};

/** The answer to "Where do I stand?" — readable in three seconds. */
export function BalanceHero({ overview, selectedCurrency, onSelectCurrency, ratesUnavailable }: BalanceHeroProps) {
  const { currency, summary, others, converted } = overview;
  const settled = summary.owed === 0 && summary.owe === 0;
  const caption = settled ? 'You’re all settled' : summary.net > 0 ? 'You’re owed overall' : summary.net < 0 ? 'You owe overall' : 'You’re even overall';

  return (
    <View>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full bg-brand-cyan" />
          <Text variant="label" tone="muted">
            Your balance
          </Text>
        </View>
        <CurrencySwitcher selected={selectedCurrency} onSelect={onSelectCurrency} />
      </View>
      <View className="mt-1.5">
        <Money amount={summary.net} currency={currency} size="hero" tone={summary.net === 0 ? 'ink' : 'auto'} sign="always" animated />
      </View>
      <Text variant="body" tone="muted" className="mt-1">
        {caption}
      </Text>

      <View className="mt-6 flex-row rounded-card border border-line bg-surface">
        <View className="flex-1 px-4 py-3.5">
          <Text variant="caption" tone="muted">
            You are owed
          </Text>
          <Money amount={summary.owed} currency={currency} size="medium" tone={summary.owed > 0 ? 'positive' : 'ink'} animated />
        </View>
        <View className="w-px bg-line" />
        <View className="flex-1 px-4 py-3.5">
          <Text variant="caption" tone="muted">
            You owe
          </Text>
          <Money amount={summary.owe} currency={currency} size="medium" tone={summary.owe > 0 ? 'negative' : 'ink'} animated />
        </View>
      </View>

      {converted ? (
        <View className="mt-2 gap-0.5">
          <Text variant="caption" tone="muted">
            Converted from {listCurrencies(converted.currencies)} at today’s rates.
          </Text>
          <Pressable onPress={() => Linking.openURL(RATES_ATTRIBUTION.url).catch(() => undefined)} accessibilityRole="link" hitSlop={8} className="self-start">
            <Text variant="caption" tone="faint">
              {RATES_ATTRIBUTION.label} · {updatedAgo(converted.updatedAt).toLowerCase()}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {ratesUnavailable ? (
        <Text variant="caption" tone="muted" className="mt-2">
          Couldn’t get today’s exchange rates, so amounts are in each taab’s own currency for now.
        </Text>
      ) : null}

      {others.length > 0 ? (
        <Text variant="caption" tone="muted" className="mt-2">
          Plus{' '}
          {others
            .map(({ currency: c, summary: s }) => (s.net >= 0 ? `${formatMoney(s.net, c)} owed to you` : `${formatMoney(-s.net, c)} you owe`) + ` in ${c}`)
            .join(', ')}
        </Text>
      ) : null}
    </View>
  );
}
