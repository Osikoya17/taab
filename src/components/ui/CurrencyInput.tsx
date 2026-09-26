import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { CURRENCIES } from '@/constants/currencies';
import { colors, fonts, noFocusRing } from '@/constants/theme';
import type { CurrencyCode, MinorUnits } from '@/types/models';
import { formatMoney, parseMoneyInput, toInputString } from '@/utils/money';

import { Text } from './Text';

export type CurrencyInputProps = {
  value: MinorUnits;
  onChange: (value: MinorUnits) => void;
  currency: CurrencyCode;
  autoFocus?: boolean;
  error?: string;
  accessibilityLabel?: string;
};

/**
 * Large amount entry. A transparent decimal-pad input sits over the display,
 * so taps focus it directly, while the visible text is always perfectly
 * formatted (₦48,000) and the caret never jumps around separators.
 */
export function CurrencyInput({ value, onChange, currency, autoFocus, error, accessibilityLabel = 'Amount' }: CurrencyInputProps) {
  const [raw, setRaw] = useState(value > 0 ? toInputString(value, currency) : '');
  const [focused, setFocused] = useState(false);
  const exponent = CURRENCIES[currency].exponent;

  function handleChange(text: string) {
    const normalized = text.trim().replace(/,/g, '');
    if (!/^\d*(?:\.\d*)?$/.test(normalized)) return;
    if (text.includes(',') && parseMoneyInput(text, currency) === null) return;
    if (normalized === '') {
      setRaw('');
      onChange(0);
      return;
    }
    // Allow a trailing "." while typing and cap fraction digits.
    const [whole, fraction] = normalized.split('.');
    if (fraction !== undefined && fraction.length > exponent) return;
    if (normalized.split('.').length > 2 || whole.length > 12) return;
    setRaw(normalized);
    onChange(parseMoneyInput(normalized, currency) ?? 0);
  }

  const [wholeText, fractionText] = raw.split('.');
  const display = raw === '' ? formatMoney(0, currency) : formatMoney(Number(wholeText || '0') * 10 ** exponent, currency, { fraction: 'never' });
  const suffix = fractionText !== undefined ? `.${fractionText}` : '';
  const empty = raw === '';

  return (
    <View className="items-center py-2">
      <View className="flex-row items-center" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: fonts.semibold,
            fontSize: 60,
            lineHeight: 68,
            letterSpacing: -2.4,
            color: empty ? colors.faint : colors.ink,
            fontVariant: ['tabular-nums'],
          }}>
          {display}
          {suffix}
        </Text>
        {focused ? <View className="ml-1 h-12 w-[2px] rounded-full bg-ink" /> : null}
      </View>
      <TextInput
        value={raw}
        onChangeText={handleChange}
        keyboardType="decimal-pad"
        inputMode="decimal"
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        contextMenuHidden
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: formatMoney(value, currency) }}
        style={[StyleSheet.absoluteFill, { opacity: 0, color: 'transparent' }, noFocusRing]}
      />
      {error ? (
        <Text variant="caption" tone="negative" className="mt-1">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
