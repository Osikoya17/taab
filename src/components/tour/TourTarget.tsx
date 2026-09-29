import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTourTargets, type TourTargetId } from '@/features/tour/targets';

/** Marks something the first-run tour can point at. Renders a plain View. */
export function TourTarget({ id, children, style, className }: { id: TourTargetId; children: ReactNode; style?: StyleProp<ViewStyle>; className?: string }) {
  const register = useTourTargets((s) => s.register);
  return (
    <View
      // Android may flatten views without their own styles; the tour needs a real one to measure.
      collapsable={false}
      testID={`tour-${id}`}
      ref={(node) => {
        register(id, node);
        return () => register(id, null);
      }}
      style={style}
      className={className}>
      {children}
    </View>
  );
}
