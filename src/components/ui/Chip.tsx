import { Lock, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors, type Palette } from '@/constants/theme';
import { cx } from '@/utils/cx';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  locked?: boolean;
  /** Shows the icon in a small circle of this colour (a palette fill and the colour on top). */
  iconColour?: { fill: keyof Palette; on: keyof Palette };
};

/** Selectable pill for filters and small choices. */
export function Chip({ label, selected = false, onPress, icon: Icon, locked, iconColour }: ChipProps) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}, locked` : label}
      accessibilityState={{ selected }}
      pressedScale={0.96}
      className={cx(
        'h-10 flex-row items-center gap-1.5 rounded-full border px-4',
        selected ? 'border-ink bg-ink' : 'border-line bg-surface',
      )}>
      {Icon && iconColour ? (
        <View className="-ml-2 h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: colors[iconColour.fill] }}>
          <Icon size={13} color={colors[iconColour.on]} strokeWidth={2.2} />
        </View>
      ) : Icon ? (
        <Icon size={15} color={selected ? colors.canvas : colors.ink} strokeWidth={2} />
      ) : null}
      <Text variant="label" tone={selected ? 'inverse' : 'ink'}>
        {label}
      </Text>
      {locked ? <Lock size={12} color={selected ? colors.canvas : colors.muted} strokeWidth={2.2} /> : null}
    </PressableScale>
  );
}
