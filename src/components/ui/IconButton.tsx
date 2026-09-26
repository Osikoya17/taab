import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { colors } from '@/constants/theme';
import { cx } from '@/utils/cx';

import { PressableScale } from './PressableScale';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only controls must be named for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: 'plain' | 'surface' | 'ink';
  size?: number;
  /** Corner radius; defaults to a circle. */
  radius?: number;
  badge?: boolean;
  disabled?: boolean;
  className?: string;
};

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  variant = 'surface',
  size = 44,
  radius,
  badge = false,
  disabled,
  className,
}: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      pressedScale={0.94}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={{ width: size, height: size, borderRadius: radius ?? size / 2 }}
      className={cx(
        'items-center justify-center',
        variant === 'surface' && 'bg-surface border border-line',
        variant === 'ink' && 'bg-ink',
        disabled && 'opacity-40',
        className,
      )}>
      <Icon size={Math.round(size * 0.42)} color={variant === 'ink' ? colors.canvas : colors.ink} strokeWidth={1.9} />
      {badge ? <View className="absolute right-[10px] top-[10px] h-2 w-2 rounded-full border border-surface bg-negative" /> : null}
    </PressableScale>
  );
}
