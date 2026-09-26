import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useAuthActions } from '@/features/auth/auth-context';
import type { OAuthProvider } from '@/features/auth/types';
import { toast } from '@/store/toast.store';

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

function AppleMark({ color }: { color: string }) {
  return (
    <Svg width={17} height={20} viewBox="0 0 17 20">
      <Path
        fill={color}
        d="M14.2 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.7 4.8 2 5.8 1.1 7.4c-1.9 3.3-.5 8.1 1.4 10.8.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.5-.9s2.1.9 3.5.8c1.5 0 2.4-1.3 3.3-2.7 1-1.5 1.5-3 1.5-3.1-.1 0-2.9-1.1-3-4.4zM11.6 3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z"
      />
    </Svg>
  );
}

/** Google and (on Apple platforms) Sign in with Apple. */
export function SocialButtons() {
  const actions = useAuthActions();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const providers: OAuthProvider[] = Platform.OS === 'ios' ? ['apple', 'google'] : ['google'];

  async function start(provider: OAuthProvider) {
    setPending(provider);
    const result = await actions.signInWithOAuth(provider);
    setPending(null);
    if (result.status === 'error' && result.message) toast.error(result.message);
  }

  return (
    <View className="gap-2.5">
      {providers.map((provider) => {
        const apple = provider === 'apple';
        const label = apple ? 'Continue with Apple' : 'Continue with Google';
        return (
          <PressableScale
            key={provider}
            onPress={() => start(provider)}
            disabled={pending !== null}
            accessibilityLabel={label}
            className={apple ? 'h-14 flex-row items-center justify-center gap-2.5 rounded-button bg-ink' : 'h-14 flex-row items-center justify-center gap-2.5 rounded-button border border-line bg-surface'}>
            {pending === provider ? (
              <ActivityIndicator color={apple ? colors.canvas : colors.ink} />
            ) : (
              <>
                {apple ? <AppleMark color={colors.canvas} /> : <GoogleMark />}
                <Text variant="bodyStrong" tone={apple ? 'inverse' : 'ink'}>
                  {label}
                </Text>
              </>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

export function OrDivider() {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-px flex-1 bg-line" />
      <Text variant="caption" tone="faint">
        or
      </Text>
      <View className="h-px flex-1 bg-line" />
    </View>
  );
}
