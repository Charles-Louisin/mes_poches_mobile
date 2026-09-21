import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color } from '@/theme/tokens';

function Bar({ delay, active, tall }: { delay: number; active: boolean; tall: boolean }) {
  const h = useSharedValue(8);
  const max = tall ? 32 : 22;

  useEffect(() => {
    if (!active) {
      h.value = withTiming(8, { duration: 180 });
      return;
    }
    h.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(max, { duration: 280, easing: Easing.inOut(Easing.quad) }),
          withTiming(8, { duration: 280, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );
  }, [active, delay, h, max]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, style]} />;
}

export function AudioLoader({ active, large = false }: { active: boolean; large?: boolean }) {
  return (
    <View style={[styles.row, large ? { height: 40 } : { height: 28 }]} accessibilityLabel="Audio en cours">
      <Bar delay={0} active={active} tall={large} />
      <Bar delay={80} active={active} tall={large} />
      <Bar delay={160} active={active} tall={large} />
      <Bar delay={90} active={active} tall={large} />
      <Bar delay={40} active={active} tall={large} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bar: {
    width: 5,
    borderRadius: 3,
    backgroundColor: color.primary,
  },
});
