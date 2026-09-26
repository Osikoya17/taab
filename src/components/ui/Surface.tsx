import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { cx } from '@/utils/cx';

import { PressableScale } from './PressableScale';

type SurfaceProps = ViewProps & {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Tighter padding for dense rows. */
  padded?: boolean;
};

/**
 * The one card treatment: white, hairline border, no shadow. Tappable when
 * `onPress` is given. Don't nest surfaces inside surfaces.
 */
export function Surface({ children, className, onPress, accessibilityLabel, padded = true, ...props }: SurfaceProps) {
  const classes = cx('rounded-card border border-line bg-surface', padded && 'p-4', className);
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} className={classes}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View className={classes} {...props}>
      {children}
    </View>
  );
}
