import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Screen } from '@/components/ui/Screen';
import { TaabLogo } from '@/components/ui/TaabLogo';
import { Text } from '@/components/ui/Text';
import { useAuthSession } from '@/features/auth/auth-context';

export type AuthScaffoldProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  back?: boolean;
  showLogo?: boolean;
};

/** Shared frame for sign in, sign up and verification. */
export function AuthScaffold({ title, subtitle, children, footer, back = false, showLogo = true }: AuthScaffoldProps) {
  const { mode } = useAuthSession();
  return (
    <Screen keyboard header={back ? <AppHeader back /> : undefined}>
      <View className={back ? 'pt-2' : 'pt-10'}>
        {showLogo && !back ? <TaabLogo size="medium" /> : null}
        <Text variant="title" className={showLogo && !back ? 'mt-10' : 'mt-2'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" tone="muted" className="mt-2">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="mt-8 gap-4">{children}</View>
      {footer ? <View className="mt-8 items-center">{footer}</View> : null}
      {mode === 'demo' ? (
        <View className="mt-10 rounded-2xl bg-sunken px-4 py-3">
          <Text variant="caption" tone="muted">
            Demo mode — no Clerk key is configured, so accounts stay on this device. Any 6-digit code works.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
