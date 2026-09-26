import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import type { CurrencyCode, MinorUnits } from '@/types/models';
import { formatMoney, minorFactor, type FormatMoneyOptions } from '@/utils/money';

const SIZES = {
  hero: { fontSize: 48, lineHeight: 54, letterSpacing: -1.8, fontFamily: fonts.semibold },
  large: { fontSize: 32, lineHeight: 38, letterSpacing: -1, fontFamily: fonts.semibold },
  medium: { fontSize: 20, lineHeight: 26, letterSpacing: -0.4, fontFamily: fonts.semibold },
  body: { fontSize: 16, lineHeight: 22, letterSpacing: -0.2, fontFamily: fonts.medium },
  small: { fontSize: 14, lineHeight: 19, letterSpacing: -0.1, fontFamily: fonts.medium },
} as const;

const TONES = {
  ink: colors.ink,
  muted: colors.muted,
  positive: colors.positive,
  negative: colors.negative,
  inverse: colors.canvas,
} as const;

export type MoneyProps = {
  amount: MinorUnits;
  currency: CurrencyCode;
  size?: keyof typeof SIZES;
  /** `auto` colours by sign: positive green, negative coral, zero ink. */
  tone?: keyof typeof TONES | 'auto';
  sign?: FormatMoneyOptions['sign'];
  fraction?: FormatMoneyOptions['fraction'];
  /** Gently count to new values (balances). */
  animated?: boolean;
  style?: StyleProp<TextStyle>;
};

/** Every amount in the app renders through here, with tabular figures. */
export function Money({ amount, currency, size = 'body', tone = 'ink', sign = 'auto', fraction = 'auto', animated = false, style }: MoneyProps) {
  const tweened = useAnimatedNumber(amount);
  // While counting, step in whole units when the final value is whole, so
  // ₦48,000 never flickers through ₦47,597.52 on the way.
  const factor = minorFactor(currency);
  const step = amount % factor === 0 ? factor : 1;
  const shown = animated ? Math.round(tweened / step) * step : amount;
  const color = tone === 'auto' ? (amount > 0 ? colors.positive : amount < 0 ? colors.negative : colors.ink) : TONES[tone];
  const final = formatMoney(amount, currency, { sign, fraction });

  return (
    <RNText
      accessibilityLabel={final}
      maxFontSizeMultiplier={size === 'hero' || size === 'large' ? 1.15 : 1.35}
      numberOfLines={1}
      adjustsFontSizeToFit={size === 'hero'}
      style={[SIZES[size], { color, fontVariant: ['tabular-nums'], includeFontPadding: false }, style]}>
      {formatMoney(shown, currency, { sign, fraction })}
    </RNText>
  );
}
