import type { LucideIcon } from 'lucide-react-native';
import { forwardRef, useState, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, noFocusRing } from '@/constants/theme';
import { cx } from '@/utils/cx';

import { Text } from './Text';

export type FormInputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Hide the visual label but keep it for screen readers. */
  hideLabel?: boolean;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
};

/** Labelled text field with inline error, used with react-hook-form Controllers. */
export const FormInput = forwardRef<TextInput, FormInputProps>(function FormInput(
  { label, hideLabel, error, hint, icon: Icon, trailing, onFocus, onBlur, editable = true, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      {!hideLabel ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <View
        className={cx(
          'min-h-[54px] flex-row items-center gap-2.5 rounded-input border bg-surface px-4',
          error ? 'border-negative' : focused ? 'border-ink' : 'border-line',
          !editable && 'opacity-60',
        )}>
        {Icon ? <Icon size={18} color={colors.muted} strokeWidth={1.9} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.faint}
          selectionColor={colors.ink}
          cursorColor={colors.ink}
          editable={editable}
          maxFontSizeMultiplier={1.4}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[{ flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, paddingVertical: 14 }, noFocusRing]}
          {...props}
        />
        {trailing}
      </View>
      {error ? (
        <Text variant="caption" tone="negative" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
