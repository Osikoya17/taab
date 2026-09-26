import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Activity, House, Layers, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text as RNText, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, floatingShadow, fonts, radii, TAB_BAR_HEIGHT } from '@/constants/theme';

const TAB_META: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Home', icon: House },
  groups: { label: 'Groups', icon: Layers },
  activity: { label: 'Activity', icon: Activity },
  profile: { label: 'Profile', icon: UserRound },
};

const INDICATOR_SPRING = { damping: 22, stiffness: 240, mass: 0.8 };

/** Native blur on iOS and web; Android uses a translucent fill (see below). */
const USE_BLUR = Platform.OS !== 'android';

/**
 * Floating acrylic navigation. A thin frosted slab above the content:
 * blur + translucent white, a hairline border, a brighter top edge and a soft
 * ambient shadow. iOS uses a native blur; Android uses a near-opaque
 * translucent fill, which reads the same and stays at 60fps on every device.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const visibility = useSharedValue(1);

  const activeKey = state.routes[state.index]?.key;
  const activeLayout = activeKey ? layouts[activeKey] : undefined;

  useEffect(() => {
    if (!activeLayout) return;
    const width = Math.min(activeLayout.width - 6, 76);
    const x = activeLayout.x + (activeLayout.width - width) / 2;
    // First placement snaps; later changes glide.
    if (indicatorW.get() === 0) {
      indicatorX.set(x);
      indicatorW.set(width);
    } else {
      indicatorX.set(withSpring(x, INDICATOR_SPRING));
      indicatorW.set(withSpring(width, INDICATOR_SPRING));
    }
  }, [activeLayout, indicatorX, indicatorW]);

  // Keep the bar out of the way while typing.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    visibility.set(withTiming(keyboardVisible ? 0 : 1, { duration: 180 }));
  }, [keyboardVisible, visibility]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorW.get(),
    transform: [{ translateX: indicatorX.get() }],
    opacity: indicatorW.get() > 0 ? 1 : 0,
  }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: visibility.get(),
    transform: [{ translateY: (1 - visibility.get()) * 24 }],
  }));

  const bottom = Math.max(insets.bottom, 12) + (Platform.OS === 'android' ? 4 : 0);

  const tabs = state.routes.map((route, index) => {
    const meta = TAB_META[route.name];
    if (!meta) return null;
    const focused = state.index === index;
    const Icon = meta.icon;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        onLayout={(e) => {
          const layout = e.nativeEvent.layout;
          setLayouts((prev) => (prev[route.key]?.x === layout.x && prev[route.key]?.width === layout.width ? prev : { ...prev, [route.key]: layout }));
        }}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        style={styles.tab}>
        <Icon size={21} color={focused ? colors.ink : colors.faint} strokeWidth={focused ? 2.1 : 1.8} />
        <RNText allowFontScaling={false} numberOfLines={1} style={[styles.label, { color: focused ? colors.ink : colors.faint }]}>
          {meta.label}
        </RNText>
      </Pressable>
    );
  });

  // The Add action sits in the middle of the four destinations.
  const addButton = (
    <Pressable
      key="add"
      onPress={() => router.push('/expense/new')}
      accessibilityRole="button"
      accessibilityLabel="Add expense"
      style={styles.tab}>
      {({ pressed }) => (
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 18,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
          }}>
          <Plus size={22} color={colors.canvas} strokeWidth={2.2} />
        </View>
      )}
    </Pressable>
  );

  const items = [...tabs.slice(0, 2), addButton, ...tabs.slice(2)];

  return (
    <Animated.View
      pointerEvents={keyboardVisible ? 'none' : 'box-none'}
      style={[styles.wrapper, { bottom }, floatingShadow, containerStyle]}>
      <View style={styles.slab}>
        {USE_BLUR ? <BlurView intensity={48} tint="light" style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: USE_BLUR ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.94)' }]} />
        {/* Faint vertical sheen gives the slab thickness. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.7 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={styles.topHighlight} />
        <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
        <View style={styles.row}>{items}</View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: TAB_BAR_HEIGHT,
    borderRadius: radii.nav,
  },
  slab: {
    flex: 1,
    borderRadius: radii.nav,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.09)',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  indicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(17,17,17,0.055)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  // One explicit style: mixing size classes let Android measure and draw the
  // label at different sizes, clipping "Activity" to "Activit".
  label: {
    marginTop: 4,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

