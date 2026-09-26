import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/constants/theme';
import { cx } from '@/utils/cx';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  className?: string;
};

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-ink',
  secondary: 'bg-surface border border-line',
  ghost: 'bg-transparent',
  danger: 'bg-negative-soft',
};

const LABEL_TONE = { primary: 'inverse', secondary: 'ink', ghost: 'ink', danger: 'negative' } as const;
const ICON_COLOR = { primary: colors.canvas, secondary: colors.ink, ghost: colors.ink, danger: colors.negative };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityHint,
  className,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={cx(
        'flex-row items-center justify-center rounded-button px-4',
        size === 'lg' ? 'h-14' : 'h-11',
        fullWidth ? 'self-stretch' : 'self-start',
        CONTAINER[variant],
        disabled && !loading && 'opacity-40',
        className,
      )}>
      {loading ? (
        <ActivityIndicator color={ICON_COLOR[variant]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {Icon ? <Icon size={18} color={ICON_COLOR[variant]} strokeWidth={2} /> : null}
          <Text variant={size === 'lg' ? 'bodyStrong' : 'label'} tone={LABEL_TONE[variant]}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}
