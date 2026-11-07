import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, type as font, radius, space } from '@/theme/tokens';

export type ToastTone = 'ok' | 'err' | 'info';

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

  useEffect(() => {
    if (!message) return;
    const hold = tone === 'err' ? 7000 : 5500;
    const extra = message.length > 80 ? 2000 : 0;
    const t = setTimeout(onDone, hold + extra);
    return () => clearTimeout(t);
  }, [id, message, onDone, tone]);

  if (!message) return null;

  const bg = tone === 'err' ? color.danger : tone === 'ok' ? color.success : color.primary;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: Math.max(insets.top, 12) + 8 }]}>
      <Animated.View
        key={id}
        entering={FadeInDown.springify().damping(18)}
        exiting={FadeOutUp.duration(220)}
        style={styles.inner}>
        <Text style={[styles.text, { backgroundColor: bg }]}>{message}</Text>
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
