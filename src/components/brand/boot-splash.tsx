import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { BrandMark } from '@/components/brand/brand-mark';
import { color, type as font } from '@/theme/tokens';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Écran de démarrage : apparition du logo puis barre de progression calée sur le chargement réel
 * (session, compte, données de l'accueil). Quand tout est prêt, la barre se termine et l'écran
 * s'efface avant d'afficher l'app.
 */
export function BootSplash({
  progress = 0,
  label = '',
  exiting = false,
  onExited,
}: {
  /** 0 à 1, étapes réellement terminées. */
  progress?: number;
  label?: string;
  /** Tout est chargé : terminer la barre puis s'effacer. */
  exiting?: boolean;
  onExited?: () => void;
}) {
  const reduced = useReducedMotion();
  const intro = useSharedValue(0);
  const p = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    intro.set(withTiming(1, { duration: reduced ? 0 : 520, easing: EASE_OUT }));
  }, [intro, reduced]);

  useEffect(() => {
    // La barre suit l'avancement réel ; elle ne recule jamais.
    p.set((cur) => withTiming(Math.max(cur, Math.min(1, progress)), { duration: 360, easing: EASE_OUT }));
  }, [p, progress]);

  useEffect(() => {
    if (!exiting) return;
    p.set(withTiming(1, { duration: 220, easing: EASE_OUT }));
    out.set(
      withDelay(
        220,
        withTiming(0, { duration: reduced ? 120 : 260, easing: EASE_OUT }, (finished) => {
          if (finished && onExited) scheduleOnRN(onExited);
        })
      )
    );
  }, [exiting, onExited, out, p, reduced]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: intro.get(),
    transform: [{ scale: reduced ? 1 : 0.94 + intro.get() * 0.06 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: intro.get() * 0.9,
    transform: [{ scale: reduced ? 1 : 0.86 + intro.get() * 0.14 }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, intro.get() * 1.4 - 0.4),
    transform: [{ translateY: reduced ? 0 : (1 - intro.get()) * 8 }],
  }));
  // Barre absolue et sans enfant : animer sa largeur ne recalcule pas la mise en page voisine.
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.round(p.get() * 100)}%` }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: out.get() }));

  const pct = Math.round(Math.min(1, progress) * 100);

  return (
    <Animated.View style={[styles.boot, rootStyle]}>
      <View style={styles.center}>
        <Animated.View style={[styles.halo, haloStyle]} />
        <Animated.View style={markStyle}>
          <BrandMark size={96} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.textBox, textStyle]}>
        <Text style={styles.word}>MES POCHES</Text>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Text style={styles.caption} numberOfLines={1}>
          {label || 'Démarrage'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  boot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  center: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: color.primaryVeryLight,
  },
  textBox: { alignItems: 'center', marginTop: 18 },
  word: { fontFamily: font.sansBold, fontSize: 20, letterSpacing: 2, color: color.text },
  track: {
    marginTop: 26,
    width: 160,
    height: 4,
    borderRadius: 99,
    backgroundColor: color.surfaceSecondary,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 99, backgroundColor: color.primary },
  caption: { marginTop: 12, fontFamily: font.sans, fontSize: 13, color: color.textSecondary },
});
