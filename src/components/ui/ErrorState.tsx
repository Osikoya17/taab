import { CloudOff } from 'lucide-react-native';
import { View } from 'react-native';

import { useColors } from '@/constants/theme';

import { Button } from './Button';
import { Text } from './Text';

export type ErrorStateProps = {
  /** e.g. "Couldn't load your taabs." */
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Friendly failure with a retry. Never shows raw technical errors. */
export function ErrorState({
  title,
  description = 'Check your connection and try again.',
  onRetry,
  retrying,
}: ErrorStateProps) {
  const colors = useColors();
  return (
    <View className="items-center px-8 py-14" accessibilityRole="alert">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-sunken">
        <CloudOff size={22} color={colors.muted} strokeWidth={1.8} />
      </View>
      <Text variant="subheading" className="mt-5 text-center">
        {title}
      </Text>
      <Text variant="body" tone="muted" className="mt-1.5 text-center">
        {description}
      </Text>
      {onRetry ? (
        <View className="mt-6">
          <Button label="Try again" variant="secondary" size="md" fullWidth={false} onPress={onRetry} loading={retrying} />
        </View>
      ) : null}
    </View>
  );
}
