import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors } from '@/constants/theme';
import { cx } from '@/utils/cx';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** Icon-over-label action used in compact action rows. */
export function ActionTile({
  icon: Icon,
  label,
  accessibilityLabel,
  onPress,
  primary = false,
}: {
  icon: LucideIcon;
  /** Short visible label; tiles are narrow on small phones. */
  label: string;
  /** Fuller description for screen readers, e.g. "Add expense" for "Add". */
  accessibilityLabel?: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const colors = useColors();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel ?? label} pressedScale={0.95} className="flex-1 items-center gap-1.5">
      <View className={cx('h-14 w-full items-center justify-center rounded-[20px]', primary ? 'bg-ink' : 'border border-line bg-surface')}>
        <Icon size={20} color={primary ? colors.canvas : colors.ink} strokeWidth={1.9} />
      </View>
      <Text variant="caption" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}
