import type { ReactNode } from 'react';
import { View } from 'react-native';

import { TourTarget } from '@/components/tour/TourTarget';
import { useColors } from '@/constants/theme';
import type { TourTargetId } from '@/features/tour/targets';

import { Button } from './Button';
import { Text } from './Text';

export type EmptyIllustration = 'receipt' | 'stack' | 'pulse' | 'bell' | 'check';

/**
 * Small abstract illustrations built from plain shapes — calm, not cute.
 * Each hints at the content that will eventually fill the space.
 */
function Illustration({ kind }: { kind: EmptyIllustration }) {
  const colors = useColors();
  switch (kind) {
    case 'receipt':
      return (
        <View className="h-24 w-20 items-center justify-between rounded-2xl border border-line bg-surface px-3 py-4">
          <View className="h-1.5 w-8 self-start rounded-full bg-line-strong" />
          <View className="w-full gap-1.5">
            <View className="h-1.5 w-full rounded-full bg-sunken" />
            <View className="h-1.5 w-3/4 rounded-full bg-sunken" />
            <View className="h-1.5 w-5/6 rounded-full bg-sunken" />
          </View>
          <View className="w-full flex-row justify-between">
            {[0, 1, 2].map((i) => (
              <View key={i} className="h-3 w-3 rounded-full" style={{ backgroundColor: i === 0 ? colors.brandCyan : colors.lineStrong }} />
            ))}
          </View>
        </View>
      );
    case 'stack':
      return (
        <View className="h-24 w-28 items-center justify-end">
          <View className="absolute top-0 h-12 w-20 rounded-2xl border border-line bg-sunken" />
          <View className="absolute top-3 h-12 w-24 rounded-2xl border border-line bg-canvas" />
          <View className="h-14 w-28 justify-center gap-1.5 rounded-2xl border border-line bg-surface px-3">
            <View className="h-1.5 w-12 rounded-full bg-brand-yellow" />
            <View className="h-1.5 w-8 rounded-full bg-sunken" />
          </View>
        </View>
      );
    case 'pulse':
      return (
        <View className="h-24 w-28 justify-center gap-3">
          {[0.9, 0.6, 0.75].map((w, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <View className="h-5 w-5 rounded-full" style={{ backgroundColor: i === 0 ? colors.brandBlue : colors.sunken }} />
              <View className="h-1.5 rounded-full bg-sunken" style={{ width: `${w * 70}%` }} />
            </View>
          ))}
        </View>
      );
    case 'bell':
      return (
        <View className="h-24 w-24 items-center justify-center">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-line bg-surface">
            <View className="h-2.5 w-2.5 rounded-full bg-brand-red" />
          </View>
        </View>
      );
    case 'check':
      return (
        <View className="h-24 w-24 items-center justify-center">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-positive-soft">
            <View
              style={{
                width: 22,
                height: 12,
                borderLeftWidth: 2.5,
                borderBottomWidth: 2.5,
                borderColor: colors.positive,
                transform: [{ rotate: '-45deg' }, { translateY: -2 }],
              }}
            />
          </View>
        </View>
      );
  }
}

export type EmptyStateProps = {
  title: string;
  description?: string;
  illustration?: EmptyIllustration;
  actionLabel?: string;
  onAction?: () => void;
  /** Lets the first-run tour point at the action. */
  actionTourId?: TourTargetId;
  children?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ title, description, illustration = 'receipt', actionLabel, onAction, actionTourId, children, compact }: EmptyStateProps) {
  return (
    <View className={compact ? 'items-center px-6 py-8' : 'items-center px-8 py-14'}>
      <Illustration kind={illustration} />
      <Text variant="heading" className="mt-6 text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="muted" className="mt-2 max-w-[300px] text-center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-6 w-full max-w-[260px]">
          {actionTourId ? (
            <TourTarget id={actionTourId}>
              <Button label={actionLabel} onPress={onAction} size="md" />
            </TourTarget>
          ) : (
            <Button label={actionLabel} onPress={onAction} size="md" />
          )}
        </View>
      ) : null}
      {children}
    </View>
  );
}
