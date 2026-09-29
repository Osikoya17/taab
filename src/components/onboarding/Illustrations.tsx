import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { SettledCheck } from '@/components/settlements/SettledCheck';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { floatingShadow, useColors } from '@/constants/theme';
import { formatMoney } from '@/utils/money';

/** 0 → 1 when a slide becomes active; resets when it leaves. */
function useEntrance(active: boolean, delay = 0, duration = 520) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (active) progress.set(withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) })));
    else progress.set(0);
  }, [active, delay, duration, progress]);
  return progress;
}

function useFadeUp(progress: SharedValue<number>, from = 0, to = 1, distance = 10) {
  return useAnimatedStyle(() => {
    const t = interpolate(progress.get(), [from, to], [0, 1], 'clamp');
    return { opacity: t, transform: [{ translateY: (1 - t) * distance }] };
  });
}

const card = 'rounded-[24px] border border-line bg-surface';

/* 1 — A receipt whose total divides between four people. */
const PARTICIPANTS = [
  { id: 'me', name: 'You' },
  { id: 'u_gbayin', name: 'Gbayin' },
  { id: 'u_macky', name: 'Macky P' },
  { id: 'u_dami', name: 'Dami' },
];

function Segment({ progress, index }: { progress: SharedValue<number>; index: number }) {
  const colors = useColors();
  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.get(), [0.25, 0.6], [0, 1], 'clamp');
    return { marginHorizontal: t * 2.5, borderRadius: 4 + t * 2 };
  });
  return <Animated.View style={[{ flex: 1, height: 10, backgroundColor: index === 0 ? colors.ink : colors.lineStrong }, style]} />;
}

function ParticipantShare({ progress, index, name, id }: { progress: SharedValue<number>; index: number; name: string; id: string }) {
  const style = useFadeUp(progress, 0.5 + index * 0.1, 0.7 + index * 0.1, 8);
  return (
    <Animated.View style={style}>
      <View className="flex-row items-center justify-between py-1.5">
        <View className="flex-row items-center gap-2.5">
          <Avatar name={name} seed={id} size={26} />
          <Text variant="label">{name}</Text>
        </View>
        <Text variant="label" tone="muted">
          {formatMoney(1_050_000, 'NGN')}
        </Text>
      </View>
    </Animated.View>
  );
}

export function ReceiptSplitIllustration({ active }: { active: boolean }) {
  const progress = useEntrance(active, 150, 1400);
  return (
    <View className={`${card} w-[260px] p-5`} style={floatingShadow}>
      <Text variant="caption" tone="muted">
        Dinner
      </Text>
      <Text variant="title" className="mt-1" style={{ fontVariant: ['tabular-nums'] }}>
        {formatMoney(4_200_000, 'NGN')}
      </Text>
      <View className="mt-4 flex-row">
        {PARTICIPANTS.map((p, i) => (
          <Segment key={p.id} progress={progress} index={i} />
        ))}
      </View>
      <View className="my-4 h-px bg-line" />
      {PARTICIPANTS.map((p, i) => (
        <ParticipantShare key={p.id} progress={progress} index={i} name={p.name} id={p.id} />
      ))}
    </View>
  );
}

/* 2 — You at the centre, connected to the people you share with. */
const AnimatedLine = Animated.createAnimatedComponent(Line);
const ORBIT = [
  { id: 'u_gbayin', name: 'Gbayin', x: 40, y: 38 },
  { id: 'u_macky', name: 'Macky P', x: 220, y: 30 },
  { id: 'u_dami', name: 'Dami', x: 200, y: 168 },
  { id: 'u_femi', name: 'Femi', x: 52, y: 160 },
];
const CENTER = { x: 130, y: 100 };

function Connector({ progress, x, y, index }: { progress: SharedValue<number>; x: number; y: number; index: number }) {
  const colors = useColors();
  const length = Math.hypot(x - CENTER.x, y - CENTER.y);
  const props = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - interpolate(progress.get(), [index * 0.12, 0.5 + index * 0.12], [0, 1], 'clamp')),
  }));
  return (
    <AnimatedLine
      x1={CENTER.x}
      y1={CENTER.y}
      x2={x}
      y2={y}
      stroke={index < 2 ? colors.positive : colors.negative}
      strokeOpacity={0.45}
      strokeWidth={1.5}
      strokeDasharray={length}
      animatedProps={props}
    />
  );
}

export function BalancesIllustration({ active }: { active: boolean }) {
  const progress = useEntrance(active, 100, 1100);
  const pills = useFadeUp(progress, 0.55, 1, 12);
  return (
    <View className="items-center">
      <View style={{ width: 260, height: 200 }}>
        <Svg width={260} height={200} style={{ position: 'absolute' }}>
          {ORBIT.map((p, i) => (
            <Connector key={p.id} progress={progress} x={p.x} y={p.y} index={i} />
          ))}
        </Svg>
        {ORBIT.map((p) => (
          <View key={p.id} style={{ position: 'absolute', left: p.x - 20, top: p.y - 20 }}>
            <Avatar name={p.name} seed={p.id} size={40} ring />
          </View>
        ))}
        <View style={{ position: 'absolute', left: CENTER.x - 28, top: CENTER.y - 28 }}>
          <View className="h-14 w-14 items-center justify-center rounded-full bg-ink">
            <Text variant="label" tone="inverse">
              You
            </Text>
          </View>
        </View>
      </View>
      <Animated.View style={[pills, { marginTop: 24, flexDirection: 'row', gap: 12 }]}>
        <View className="rounded-[18px] bg-positive-soft px-4 py-3">
          <Text variant="caption" tone="positive">
            You are owed
          </Text>
          <Text variant="subheading" tone="positive">
            {formatMoney(1_850_000, 'NGN')}
          </Text>
        </View>
        <View className="rounded-[18px] bg-negative-soft px-4 py-3">
          <Text variant="caption" tone="negative">
            You owe
          </Text>
          <Text variant="subheading" tone="negative">
            {formatMoney(400_000, 'NGN')}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* 3 — Every kind of group, stacked. */
const MINI_GROUPS = [
  { name: 'Flat 12', status: `${formatMoney(1_820_000, 'NGN')} unsettled`, people: ['me', 'u_gbayin', 'u_macky'] },
  { name: 'Detty December', status: `${formatMoney(8_250_000, 'NGN')} unsettled`, people: ['me', 'u_femi', 'u_zainab'] },
  { name: 'Weekend Trip', status: 'Settled', people: ['me', 'u_dami'] },
];

function MiniGroup({ progress, index }: { progress: SharedValue<number>; index: number }) {
  const g = MINI_GROUPS[index];
  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.get(), [index * 0.15, 0.55 + index * 0.15], [0, 1], 'clamp');
    return { opacity: t, transform: [{ translateY: (1 - t) * 26 }, { scale: 0.96 + t * 0.04 }] };
  });
  return (
    <Animated.View style={[style, { marginTop: index === 0 ? 0 : 10 }, floatingShadow]}>
      <View className={`${card} w-[272px] flex-row items-center gap-3 px-4 py-3.5`}>
      <View className="flex-row">
        {g.people.map((id, i) => (
          <View key={id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
            <Avatar name={id === 'me' ? 'You' : id.slice(2)} seed={id} size={26} ring />
          </View>
        ))}
      </View>
      <View className="flex-1">
        <Text variant="bodyStrong">{g.name}</Text>
        <Text variant="caption" tone={g.status === 'Settled' ? 'positive' : 'muted'}>
          {g.status}
        </Text>
      </View>
      </View>
    </Animated.View>
  );
}

export function GroupsIllustration({ active }: { active: boolean }) {
  const progress = useEntrance(active, 100, 1000);
  return (
    <View className="items-center">
      {MINI_GROUPS.map((g, i) => (
        <MiniGroup key={g.name} progress={progress} index={i} />
      ))}
    </View>
  );
}

/* 4 — An outstanding balance becomes "Settled". */
export function SettledIllustration({ active }: { active: boolean }) {
  const [fired, setFired] = useState(false);
  const settled = active && fired;

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setFired(true), 1100);
    return () => {
      clearTimeout(timer);
      setFired(false);
    };
  }, [active]);

  return (
    <View className="h-[240px] w-[272px] items-center justify-center">
      {settled ? (
        <Animated.View key="settled" entering={FadeIn.duration(260)} style={{ alignItems: 'center' }}>
          <SettledCheck size={112} />
          <Text variant="title" className="mt-4">
            Settled
          </Text>
        </Animated.View>
      ) : (
        <Animated.View key="owed" entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)}>
          <View className={`${card} w-[272px] p-5`} style={floatingShadow}>
            <View className="flex-row items-center gap-3">
              <Avatar name="Gbayin" seed="u_gbayin" size={40} />
              <View className="flex-1">
                <Text variant="caption" tone="muted">
                  You owe Gbayin
                </Text>
                <Text variant="heading" tone="negative">
                  {formatMoney(850_000, 'NGN')}
                </Text>
              </View>
            </View>
            <View className="mt-4 h-11 items-center justify-center rounded-[16px] bg-ink">
              <Text variant="label" tone="inverse">
                Record payment
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
