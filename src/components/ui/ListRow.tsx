import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useColors } from '@/constants/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ListRowProps = {
  title: string;
  detail?: string;
  icon?: LucideIcon;
  /** Right-aligned value text, e.g. "NGN". */
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
  showChevron?: boolean;
};

/** Settings-style row. Group several inside one Surface with Dividers. */
export function ListRow({ title, detail, icon: Icon, value, onPress, trailing, destructive, showChevron = !!onPress }: ListRowProps) {
  const colors = useColors();
  const content = (
    <View className="min-h-[56px] flex-row items-center gap-3 px-4 py-3">
      {Icon ? (
        <View className="h-8 w-8 items-center justify-center rounded-xl bg-sunken">
          <Icon size={17} color={destructive ? colors.negative : colors.ink} strokeWidth={1.9} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text variant="bodyStrong" tone={destructive ? 'negative' : 'ink'}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted" className="mt-0.5">
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" tone="muted">
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <ChevronRight size={18} color={colors.faint} strokeWidth={2} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} accessibilityHint={detail} pressedScale={0.99}>
      {content}
    </PressableScale>
  );
}
