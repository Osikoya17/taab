import { View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} accessibilityLabel={actionLabel} hitSlop={12} className="py-1">
          <Text variant="label" tone="muted">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
