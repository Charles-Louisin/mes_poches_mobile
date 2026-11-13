import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, type as font, radius, space } from '@/theme/tokens';

export type ToastTone = 'ok' | 'err' | 'info';

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 600;
const OFFSCREEN = Dimensions.get('window').width;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function ToastHost({
  id,
  message,
  tone,
  onDone,
}: {
  id: number;
  message: string | null;
  tone: ToastTone;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const x = useSharedValue(0);

  useEffect(() => {
    if (!message) return;
    x.set(0);
    const hold = tone === 'err' ? 7000 : 5500;
    const extra = message.length > 80 ? 2000 : 0;
    const t = setTimeout(onDone, hold + extra);
    return () => clearTimeout(t);
  }, [id, message, onDone, tone, x]);

  // Glisser vers la gauche ou la droite ferme le toast (une pichenette suffit).
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      x.set(e.translationX);
    })
    .onEnd((e) => {
      const flung = Math.abs(e.translationX) > DISMISS_DISTANCE || Math.abs(e.velocityX) > DISMISS_VELOCITY;
      if (flung) {
        const dir = (e.translationX || e.velocityX) < 0 ? -1 : 1;
        x.set(
          withTiming(dir * OFFSCREEN, { duration: 180, easing: EASE_OUT }, (finished) => {
            if (finished) scheduleOnRN(onDone);
          })
        );
      } else {
        x.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityX }));
      }
    });

  const swipe = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: 1 - Math.min(0.6, Math.abs(x.get()) / OFFSCREEN),
  }));

  if (!message) return null;

  const bg = tone === 'err' ? color.danger : tone === 'ok' ? color.success : color.primary;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: Math.max(insets.top, 12) + 8 }]}>
      <Animated.View key={id} entering={FadeInDown.duration(240)} exiting={FadeOutUp.duration(200)} style={styles.inner}>
        <GestureDetector gesture={pan}>
          <Animated.View style={swipe} accessibilityRole="alert" accessibilityHint="Glisser sur le côté pour fermer">
            <Text style={[styles.text, { backgroundColor: bg }]}>{message}</Text>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
  },
  inner: {
    maxWidth: '100%',
    alignItems: 'center',
  },
  text: {
    color: color.white,
    fontFamily: font.sansMed,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    borderRadius: radius.pill,
    overflow: 'hidden',
    maxWidth: '100%',
    textAlign: 'center',
  },
});
