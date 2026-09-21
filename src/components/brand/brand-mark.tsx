import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { color, type as font } from '@/theme/tokens';

const MARK = require('@/assets/brand/mark.png');

export function BrandMark({ size = 64, bezel: _bezel = true }: { size?: number; bezel?: boolean }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={MARK} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
    </View>
  );
}

export function BrandLockup({
  size = 44,
  caption,
  align = 'left',
}: {
  size?: number;
  caption?: string;
  align?: 'left' | 'center';
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      style={[styles.lockup, align === 'center' && { alignSelf: 'center' }]}>
      <BrandMark size={size} />
      <View>
        <Text style={styles.word}>Mes Poches</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </Animated.View>
  );
}

export function BrandWatermark({
  size = 260,
  opacity = 0.06,
  style,
}: {
  size?: number;
  opacity?: number;
  style?: object;
}) {
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', opacity }, style]}>
      <Image source={MARK} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { fontFamily: font.sansBold, fontSize: 20, color: color.text },
  caption: {
    fontFamily: font.sansMed,
    fontSize: 12,
    color: color.textMuted,
    marginTop: 2,
  },
});
