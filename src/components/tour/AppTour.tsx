import { useEffect, useState } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path, Rect as SvgRect } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { tourLayout, type Rect } from '@/features/tour/layout';
import { measureTarget, TOUR_STEPS, useTourTargets, type TourStep } from '@/features/tour/targets';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/store/preferences.store';

/** Fixed so the spotlight reads the same in light and dark themes. */
const DIM = 'rgba(0,0,0,0.62)';
const CHALK = '#F7F7F5';
const RADIUS = 18;

/** A full-screen dim layer with a rounded hole over the target. */
function spotlightPath(hole: Rect, screen: { width: number; height: number }) {
  const { x, y, width: w, height: h } = hole;
  const r = Math.min(RADIUS, w / 2, h / 2);
  return [
    `M0 0H${screen.width}V${screen.height}H0Z`,
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`,
  ].join(' ');
}

/**
 * First-run walkthrough on Home. Dims the screen, spotlights one thing at a
 * time and points at it with an arrow and a short tip. Shown once per device;
 * "Show me around" in Help replays it.
 */
export function AppTour({ ready }: { ready: boolean }) {
  const hydrated = usePreferences((s) => s.hydrated);
  const hasSeenTour = usePreferences((s) => s.hasSeenTour);
  // Mounting a fresh run each time means a replay always starts from step one.
  return ready && hydrated && !hasSeenTour ? <TourRun /> : null;
}

function TourRun() {
  const completeTour = usePreferences((s) => s.completeTour);
  const nodes = useTourTargets((s) => s.nodes);
  const screen = useWindowDimensions();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<{ index: number; rect: Rect } | null>(null);
  const rect = measured?.index === index ? measured.rect : null;

  // Let the screen settle, then keep only the steps whose targets are on screen.
  useEffect(() => {
    if (steps) return;
    const timer = setTimeout(() => setSteps(TOUR_STEPS.filter((s) => nodes[s.target])), 700);
    return () => clearTimeout(timer);
  }, [steps, nodes]);

  const step = steps?.[index];
  // Past the last step (or nothing to show): remember it's been seen.
  const done = !!steps && index >= steps.length;
  useEffect(() => {
    if (done) completeTour();
  }, [done, completeTour]);

  useEffect(() => {
    if (!step) return;
    const node = useTourTargets.getState().nodes[step.target];
    let cancelled = false;
    (node ? measureTarget(node) : Promise.resolve(null)).then((found) => {
      if (cancelled) return;
      // Something scrolled away or unmounted: move on rather than point at nothing.
      if (found) setMeasured({ index, rect: found });
      else setIndex((i) => i + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [step, index, screen.width, screen.height]);

  function finish() {
    completeTour();
  }

  function next() {
    haptics.selection();
    if (steps && index < steps.length - 1) setIndex(index + 1);
    else finish();
  }

  if (!steps || done || !step || !rect) return null;

  const layout = tourLayout(rect, screen);
  const { arrow, head } = layout;
  const last = index === steps.length - 1;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={finish}>
      <View style={{ flex: 1 }} accessibilityViewIsModal>
        <Svg width={screen.width} height={screen.height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
          <Path d={spotlightPath(layout.hole, screen)} fill={DIM} fillRule="evenodd" />
          <SvgRect
            x={layout.hole.x}
            y={layout.hole.y}
            width={layout.hole.width}
            height={layout.hole.height}
            rx={Math.min(RADIUS, layout.hole.width / 2, layout.hole.height / 2)}
            fill="none"
            stroke={CHALK}
            strokeOpacity={0.9}
            strokeWidth={2}
          />
          <Path
            d={`M${arrow.start.x} ${arrow.start.y} C${arrow.control1.x} ${arrow.control1.y} ${arrow.control2.x} ${arrow.control2.y} ${arrow.end.x} ${arrow.end.y}`}
            stroke={CHALK}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="1 7"
            fill="none"
          />
          <Path
            d={`M${head[0].x} ${head[0].y} L${arrow.end.x} ${arrow.end.y} L${head[1].x} ${head[1].y}`}
            stroke={CHALK}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>

        <Animated.View
          key={index}
          entering={FadeIn.duration(220)}
          style={{ position: 'absolute', left: 20, right: 20, ...(layout.cardBelow ? { top: layout.cardOffset } : { bottom: layout.cardOffset }) }}>
          <View className="rounded-card bg-surface px-5 pb-4 pt-5" accessibilityLiveRegion="polite">
            <Text variant="micro" tone="muted">
              {index + 1} of {steps.length}
            </Text>
            <Text variant="heading" className="mt-1">
              {step.title}
            </Text>
            <Text variant="body" tone="muted" className="mt-1.5">
              {step.body}
            </Text>
            <View className="mt-4 flex-row items-center justify-between">
              {last ? <View /> : <Button label="Skip" variant="ghost" size="md" fullWidth={false} onPress={finish} accessibilityHint="Ends the walkthrough" />}
              <Button label={last ? 'Got it' : 'Next'} size="md" fullWidth={false} onPress={next} className="px-6" />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
