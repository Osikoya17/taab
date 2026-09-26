import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BalancesIllustration,
  GroupsIllustration,
  ReceiptSplitIllustration,
  SettledIllustration,
} from '@/components/onboarding/Illustrations';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { TaabLogo } from '@/components/ui/TaabLogo';
import { Text } from '@/components/ui/Text';
import { usePreferences } from '@/store/preferences.store';

const SLIDES = [
  {
    key: 'split',
    title: 'Split bills without the maths.',
    body: 'Add what you paid, choose who was involved, and taab works out everyone’s share.',
    Illustration: ReceiptSplitIllustration,
  },
  {
    key: 'balances',
    title: 'Always know who owes who.',
    body: 'taab keeps everyone’s balance clear so nobody has to remember it themselves.',
    Illustration: BalancesIllustration,
  },
  {
    key: 'groups',
    title: 'Made for every group.',
    body: 'Roommates, trips, dates, football nights, subscriptions — create a taab for anything.',
    Illustration: GroupsIllustration,
  },
  {
    key: 'settle',
    title: 'Settle. Done.',
    body: 'See exactly what you owe, mark payments as settled, and keep a clear history.',
    Illustration: SettledIllustration,
  },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);
  const listRef = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const [index, setIndex] = useState(0);
  const position = useSharedValue(0);
  const isLast = index === SLIDES.length - 1;

  function goTo(next: number) {
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }

  function finish(destination: '/sign-up' | '/sign-in') {
    router.replace(destination);
    completeOnboarding();
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View className="h-14 flex-row items-center justify-between px-5">
        <TaabLogo size="small" />
        {!isLast ? (
          <PressableScale onPress={() => goTo(SLIDES.length - 1)} accessibilityLabel="Skip" hitSlop={12} className="py-2">
            <Text variant="label" tone="muted">
              Skip
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => position.set(e.nativeEvent.contentOffset.x / Math.max(1, width))}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index: i }) => (
          <View style={{ width }} className="flex-1 px-7">
            <View className="flex-1 items-center justify-center">
              <item.Illustration active={i === index} />
            </View>
            <View className="pb-4">
              <Text variant="title" style={{ fontSize: 32, lineHeight: 38 }}>
                {item.title}
              </Text>
              <Text variant="body" tone="muted" className="mt-3" style={{ fontSize: 17, lineHeight: 24 }}>
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />

      <View className="gap-5 px-7 pt-4">
        <ProgressDots count={SLIDES.length} position={position} current={index} />
        {isLast ? (
          <View className="gap-2">
            <Button label="Create your taab" onPress={() => finish('/sign-up')} />
            <Button label="I already have an account" variant="ghost" onPress={() => finish('/sign-in')} />
          </View>
        ) : (
          <View className="flex-row items-center gap-3">
            {index > 0 ? <IconButton icon={ArrowLeft} accessibilityLabel="Back" size={56} onPress={() => goTo(index - 1)} /> : null}
            <View className="flex-1">
              <Button label="Next" onPress={() => goTo(index + 1)} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
