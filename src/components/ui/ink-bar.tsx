import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { color, radius } from '@/theme/tokens';

export function InkBar({
  value,
  tone = 'brass',
  delay = 0,
}: {
  value: number;
  tone?: 'brass' | 'ember' | 'moss' | 'primary' | 'danger' | 'success';
  delay?: number;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = withDelay(delay, withTiming(pct, { duration: 720, easing: Easing.out(Easing.cubic) }));
  }, [delay, grow, pct]);

  const fill =
    tone === 'ember' || tone === 'danger'
      ? color.danger
      : tone === 'moss' || tone === 'success'
        ? color.success
        : color.primary;

  const anim = useAnimatedStyle(() => ({ width: `${grow.value}%` }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: fill }, anim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 14,
    backgroundColor: color.surfaceSecondary,
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  fill: {
    height: 14,
    borderRadius: radius.pill,
  },
});
