import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { color, type as font } from '@/theme/tokens';

export function Amount({
  value,
  amount,
  format,
  size = 40,
  color: tint = color.text,
  align = 'left',
  duration = 620,
}: {
  value?: string;
  amount?: number;
  format?: (n: number) => string;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  duration?: number;
}) {
  const rolled = useRoll(amount ?? 0, duration, amount !== undefined);
  const text = amount !== undefined && format ? format(rolled) : (value ?? '');

  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[
        styles.amount,
        { fontSize: size, color: tint, textAlign: align, lineHeight: size * 1.12 },
      ]}>
      {text}
    </Text>
  );
}

function useRoll(target: number, duration: number, enabled: boolean) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (!enabled) return;
    const start = from.current;
    if (start === target) {
      setShown(target);
      return;
    }
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (target - start) * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        from.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, enabled, target]);

  return shown;
}

const styles = StyleSheet.create({
  amount: {
    fontFamily: font.sansBold,
    letterSpacing: -0.8,
  },
});
