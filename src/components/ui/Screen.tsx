import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBottomInset } from '@/hooks/use-bottom-inset';
import { cx } from '@/utils/cx';

export type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Lists should pass false and use FlatList. */
  scroll?: boolean;
  /** Leave room for the floating tab bar. */
  withTabBar?: boolean;
  /** Apply the top safe-area inset (off for modals with their own header). */
  safeTop?: boolean;
  /** Pin content (e.g. a CTA) to the bottom, above the keyboard. */
  footer?: ReactNode;
  header?: ReactNode;
  keyboard?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentClassName?: string;
  background?: 'canvas' | 'surface';
};

/** Base layout for every screen: safe areas, keyboard handling, gutters. */
export function Screen({
  children,
  scroll = true,
  withTabBar = false,
  safeTop = true,
  footer,
  header,
  keyboard = false,
  refreshControl,
  contentClassName,
  background = 'canvas',
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset(withTabBar);
  const footerPadding = Math.max(insets.bottom, 16);

  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cx('px-5', contentClassName)}
      contentContainerStyle={{ paddingBottom: footer ? 24 : bottomInset }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  ) : (
    <View className={cx('flex-1', contentClassName)}>{children}</View>
  );

  const content = (
    <>
      {header}
      {body}
      {footer ? (
        <View className="border-t border-line bg-canvas px-5 pt-3" style={{ paddingBottom: footerPadding }}>
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <View className={cx('flex-1', background === 'canvas' ? 'bg-canvas' : 'bg-surface')} style={{ paddingTop: safeTop ? insets.top : 0 }}>
      {keyboard ? (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}
