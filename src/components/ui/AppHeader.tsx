import { useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type AppHeaderProps = {
  title?: string;
  /** Large left-aligned title (tab roots) vs compact centred title (pushed screens). */
  large?: boolean;
  back?: boolean | 'close';
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: string;
};

export function AppHeader({ title, large = false, back = false, onBack, right, subtitle }: AppHeaderProps) {
  const router = useRouter();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  if (large) {
    return (
      <View className="flex-row items-end justify-between px-5 pb-4 pt-3">
        <View className="flex-1">
          {subtitle ? (
            <Text variant="caption" tone="muted">
              {subtitle}
            </Text>
          ) : null}
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
      </View>
    );
  }

  return (
    <View className="h-14 flex-row items-center justify-between px-4">
      <View className="w-24 flex-row">
        {back ? (
          <IconButton
            icon={back === 'close' ? X : ChevronLeft}
            accessibilityLabel={back === 'close' ? 'Close' : 'Back'}
            variant="plain"
            onPress={goBack}
          />
        ) : null}
      </View>
      <Text variant="subheading" numberOfLines={1} className="flex-1 text-center" accessibilityRole="header">
        {title}
      </Text>
      <View className="w-24 flex-row justify-end">{right}</View>
    </View>
  );
}

/** Modal header: Cancel · Title · Save. */
export function SheetHeader({
  title,
  onCancel,
  cancelLabel = 'Cancel',
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  onCancel: () => void;
  cancelLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <View className="h-14 flex-row items-center justify-between px-5">
      <PressableScale onPress={onCancel} accessibilityLabel={cancelLabel} hitSlop={12} className="min-w-[64px] py-2">
        <Text variant="bodyStrong" tone="muted">
          {cancelLabel}
        </Text>
      </PressableScale>
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      <View className="min-w-[64px] items-end">
        {actionLabel && onAction ? (
          <PressableScale
            onPress={onAction}
            disabled={actionDisabled}
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: actionDisabled }}
            hitSlop={12}
            className="py-2">
            <Text variant="bodyStrong" tone={actionDisabled ? 'faint' : 'ink'}>
              {actionLabel}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}
