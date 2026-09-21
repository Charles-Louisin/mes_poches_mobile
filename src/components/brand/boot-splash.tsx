import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandMark } from '@/components/brand/brand-mark';
import { color, type as font } from '@/theme/tokens';

export function BootSplash() {
  const scale = useSharedValue(0.72);
  const opacity = useSharedValue(0);
  const ring = useSharedValue(0.4);
  const bar = useSharedValue(0.12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 420 });
    scale.value = withSequence(
      withTiming(1.06, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 280, easing: Easing.inOut(Easing.quad) })
    );
    ring.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    bar.value = withDelay(180, withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }), -1, true));
  }, [bar, opacity, ring, scale]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + ring.value * 0.22,
    transform: [{ scale: 0.92 + ring.value * 0.12 }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${18 + bar.value * 62}%`,
  }));

  return (
    <View style={styles.boot}>
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={markStyle}>
        <BrandMark size={108} />
      </Animated.View>
      <Text style={styles.word}>MES POCHES</Text>
      <Text style={styles.caption}>On prépare votre grand livre</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: color.primaryLight,
  },
  word: {
    marginTop: 22,
    fontFamily: font.sansBold,
    fontSize: 22,
    letterSpacing: 1.6,
    color: color.text,
  },
  caption: {
    marginTop: 8,
    fontFamily: font.sans,
    fontSize: 14,
    color: color.textSecondary,
  },
  track: {
    marginTop: 28,
    width: 168,
    height: 6,
    borderRadius: 99,
    backgroundColor: color.surfaceSecondary,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 99,
    backgroundColor: color.primary,
  },
});
