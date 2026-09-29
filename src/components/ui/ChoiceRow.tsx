import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors } from '@/constants/theme';
import { cx } from '@/utils/cx';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** Full-width single-choice row used in setup and settings pickers. */
export function ChoiceRow({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      pressedScale={0.99}
      className={cx('min-h-[56px] flex-row items-center rounded-input border bg-surface px-4 py-3', selected ? 'border-ink' : 'border-line')}>
      <View className="flex-1">
        <Text variant="bodyStrong">{label}</Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <View
        className="h-6 w-6 items-center justify-center rounded-full border"
        style={{ backgroundColor: selected ? colors.ink : 'transparent', borderColor: selected ? colors.ink : colors.lineStrong }}>
        {selected ? <Check size={13} color={colors.canvas} strokeWidth={3} /> : null}
      </View>
    </PressableScale>
  );
}
