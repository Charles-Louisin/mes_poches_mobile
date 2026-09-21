import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Stop, RadialGradient } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color } from '@/theme/tokens';
import { BIG_ROSETTE, SMALL_ROSETTE, WAVES } from './guilloche';

/**
 * Fond commun à tous les écrans : lueur laiton, deux rosaces gravées qui
 * tournent très lentement, une trame d'ondes et un grain de papier.
 * Décoratif uniquement — jamais interactif.
 */
export function AtelierBackdrop() {
  const slow = useSharedValue(0);
  const reverse = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    slow.value = withRepeat(withTiming(1, { duration: 96000, easing: Easing.linear }), -1);
    reverse.value = withRepeat(withTiming(1, { duration: 132000, easing: Easing.linear }), -1);
    drift.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift, reverse, slow]);

  const bigStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${slow.value * 360}deg` }, { scale: 1 + drift.value * 0.03 }],
  }));

  const smallStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-reverse.value * 360}deg` }],
  }));

  const wavesStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + drift.value * 0.5,
    transform: [{ translateX: -18 + drift.value * 18 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['rgba(226,201,168,0.10)', 'rgba(226,201,168,0.02)', 'transparent']}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 0.9, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="halo" cx="82%" cy="8%" r="62%">
            <Stop offset="0" stopColor={color.brass} stopOpacity="0.13" />
            <Stop offset="1" stopColor={color.brass} stopOpacity="0" />
          </RadialGradient>
          <Pattern id="grain" x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
            <Circle cx="1" cy="1" r="0.6" fill={color.brass} opacity="0.13" />
            <Circle cx="4.5" cy="4" r="0.45" fill={color.ivory} opacity="0.07" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grain)" />
      </Svg>

      <Animated.View style={[styles.waves, wavesStyle]}>
        <Svg width={420} height={132} pointerEvents="none">
          <G>
            {WAVES.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={color.brass}
                strokeOpacity={0.14}
                strokeWidth={0.6}
                fill="none"
              />
            ))}
          </G>
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.big, bigStyle]}>
        <Svg width={320} height={320} viewBox="-160 -160 320 320" pointerEvents="none">
          <G>
            {BIG_ROSETTE.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={color.brass}
                strokeOpacity={i % 2 ? 0.09 : 0.16}
                strokeWidth={0.55}
                fill="none"
              />
            ))}
          </G>
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.small, smallStyle]}>
        <Svg width={200} height={200} viewBox="-100 -100 200 200" pointerEvents="none">
          <G>
            {SMALL_ROSETTE.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={color.brass}
                strokeOpacity={0.1}
                strokeWidth={0.5}
                fill="none"
              />
            ))}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { position: 'absolute', right: -128, top: -96 },
  small: { position: 'absolute', left: -92, bottom: 84 },
  waves: { position: 'absolute', left: 0, bottom: -14 },
});
