import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoinsArt, GiftArt } from '@/components/illustrations';
import { useTutorial } from '@/contexts/tutorial';
import { color, radius, type as font } from '@/theme/tokens';
import { Button } from '@/components/ui/button';

const PAD = 8;
const RADIUS = 16;

const AUTH_PATHS = [
  'login',
  'onboarding',
  'verify',
  'forgot',
  'capture-setup',
  'auth/google',
];

export function TutorialOverlay() {
  const { active, meta, rects, next, skip } = useTutorial();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();

  const onAuth = AUTH_PATHS.some((part) => pathname.includes(part));

  if (!active || !meta || onAuth) return null;

  const target = meta.target ? rects[meta.target] : undefined;
  const hole = target
    ? {
        x: Math.max(6, target.x - PAD),
        y: Math.max(6, target.y - PAD),
        w: target.width + PAD * 2,
        h: target.height + PAD * 2,
      }
    : null;

  const isModal = meta.mode === 'modal';
  const cardTop =
    hole && hole.y > H * 0.42
      ? Math.max(insets.top + 12, hole.y - 200)
      : hole
        ? hole.y + hole.h + 16
        : undefined;

  const onHolePress = () => {
    if (meta.mode !== 'tap') return;
    if (meta.id === 'pocket-tab') router.navigate('/(tabs)/wallets');
    else if (meta.id === 'category-tab') router.navigate('/(tabs)/categories');
  };

  const holeIsButton = meta.mode === 'tap' && (meta.id === 'pocket-tab' || meta.id === 'category-tab');

  return (
    <View style={styles.root} pointerEvents="box-none">
      {isModal ? (
        <Animated.View entering={FadeIn.duration(220)} style={[styles.dim, StyleSheet.absoluteFill]} />
      ) : hole ? (
        <>
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
          <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
          <View style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                top: hole.y,
                left: hole.x,
                width: hole.w,
                height: hole.h,
                borderRadius: RADIUS,
              },
            ]}
          />
          {holeIsButton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={meta.title}
              onPress={onHolePress}
              style={{
                position: 'absolute',
                top: hole.y,
                left: hole.x,
                width: hole.w,
                height: hole.h,
              }}
            />
          ) : null}
        </>
      ) : (
        <View style={[styles.dim, StyleSheet.absoluteFill]} />
      )}

      {isModal ? (
        <View style={styles.modalWrap} pointerEvents="box-none">
          <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.modal}>
            {meta.id === 'success' ? <CoinsArt size={160} /> : <GiftArt size={160} />}
            <Text style={[styles.title, styles.modalTitle]}>{meta.title}</Text>
            <Text style={[styles.body, styles.modalBody]}>{meta.body}</Text>
            <Button label={meta.cta ?? 'OK'} onPress={next} />
          </Animated.View>
        </View>
      ) : (
        <Animated.View
          entering={FadeInUp.springify().damping(18)}
          style={[
            styles.card,
            cardTop != null
              ? { top: Math.min(Math.max(cardTop, insets.top + 8), H - 220) }
              : { bottom: insets.bottom + 88 },
          ]}>
          <View style={styles.cardHead}>
            <Text style={styles.title}>{meta.title}</Text>
            <Pressable onPress={skip} hitSlop={8} accessibilityRole="button" accessibilityLabel="Passer le guide">
              <Text style={styles.skip}>Passer</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>{meta.body}</Text>
          {meta.mode === 'tap' && hole ? (
            <Text style={styles.hint}>Appuyez sur la zone éclairée — c’est l’action de cette étape.</Text>
          ) : (
            <Button label={meta.cta ?? 'Suivant'} onPress={next} />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    elevation: 200,
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  glow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: color.primary,
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: color.white,
    borderRadius: radius.card,
    padding: 18,
    gap: 10,
  },
  modalWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: color.white,
    borderRadius: radius.card,
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  modalBody: { textAlign: 'center' },
  modalTitle: { textAlign: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: font.sansBold, fontSize: 18, color: color.text, flex: 1 },
  body: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.textSecondary },
  hint: { fontFamily: font.sansMed, fontSize: 12, color: color.primary },
  skip: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
});
