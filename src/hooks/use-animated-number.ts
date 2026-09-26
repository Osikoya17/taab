import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tweens an integer towards `target` over ~`duration` ms with an ease-out
 * curve. Used for balances so changes feel alive without being showy.
 * Respects Reduce Motion by jumping straight to the value.
 */
export function useAnimatedNumber(target: number, duration = 420): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    const from = valueRef.current;
    if (from === target) return;

    // Frames can be paused (backgrounded app, hidden tab). Always land on the
    // exact value shortly after the animation should have finished.
    const settle = setTimeout(() => {
      cancelAnimationFrame(frame);
      valueRef.current = target;
      setValue(target);
    }, duration + 80);

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        valueRef.current = target;
        setValue(target);
        return;
      }
      const start = Date.now();
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const next = t === 1 ? target : Math.round(from + (target - from) * eased);
        valueRef.current = next;
        setValue(next);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      clearTimeout(settle);
      cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  return value;
}
