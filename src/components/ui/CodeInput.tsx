import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, noFocusRing } from '@/constants/theme';
import { cx } from '@/utils/cx';

import { Text } from './Text';

export type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
};

/**
 * One-time code boxes. A transparent input covers the boxes, so taps focus it
 * directly; it supports paste and iOS/Android code autofill.
 */
export function CodeInput({ value, onChange, length = 6, error, autoFocus = true, onComplete }: CodeInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <View>
        <View className="flex-row justify-between gap-2" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length }, (_, i) => {
            const active = focused && i === Math.min(value.length, length - 1);
            return (
              <View
                key={i}
                className={cx(
                  'h-14 flex-1 items-center justify-center rounded-2xl border bg-surface',
                  error ? 'border-negative' : active ? 'border-ink' : 'border-line',
                )}>
                <Text allowFontScaling={false} style={{ fontFamily: fonts.semibold, fontSize: 22, color: colors.ink }}>
                  {value[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          value={value}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '').slice(0, length);
            onChange(digits);
            if (digits.length === length) onComplete?.(digits);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={length}
          caretHidden
          accessibilityLabel={`Verification code, ${length} digits`}
          style={[StyleSheet.absoluteFill, { opacity: 0, color: 'transparent' }, noFocusRing]}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="negative" className="mt-2" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
