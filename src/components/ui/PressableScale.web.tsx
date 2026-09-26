import { Pressable } from 'react-native';

import type { PressableScaleProps } from './PressableScale';

/**
 * Keep the web press target stable between pointer-down and pointer-up.
 * Re-rendering NativeWind's interop target on press can cancel mouse clicks.
 *
 * Opted out of the React Compiler: NativeWind's web interop appends class
 * styles into the `style` array it receives, so a memoised array would
 * accumulate stale classes across renders.
 */
export function PressableScale({ children, style, pressedScale: _pressedScale, disabled, ...props }: PressableScaleProps) {
  'use no memo';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={style}
      {...props}>
      {children}
    </Pressable>
  );
}
