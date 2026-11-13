import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/auth';
import { BrandLockup } from '@/components/brand/brand-mark';
import { ChartArt, CoinsArt, GiftArt, WriteArt } from '@/components/illustrations';
import { Button } from '@/components/ui/button';
import { PressScale } from '@/components/ui/press-scale';
import { color, motion, type as font, typeScale } from '@/theme/tokens';
import { isAndroidNative, isMoneyCaptureEnabled } from '@/lib/sms-monitor';
import { STORAGE_KEYS, getString } from '@/lib/storage';

const PAGES = [
  {
    key: 'balance',
    Art: CoinsArt,
    title: 'Vos poches, un seul regard',
    body: 'Cash, Orange Money, MTN, banque : chaque poche a son propre solde, mis à jour à chaque mouvement.',
  },
  {
    key: 'capture',
    Art: WriteArt,
    title: 'Saisir, scanner ou valider',
    body: 'À la main, en photo d’un ticket ou depuis une notification Mobile Money : l’app prépare, vous validez.',
  },
  {
    key: 'insights',
    Art: ChartArt,
    title: 'Comprendre vos mois',
    body: 'Entrées, sorties et catégories du mois, comparées au mois précédent : vous voyez où part l’argent.',
  },
  {
    key: 'premium',
    Art: GiftArt,
    title: 'Un mois Premium offert',
    body: 'Scan, dictée et analyses sont inclus pendant un mois. Ensuite, vous choisissez un forfait ou restez en gratuit.',
  },
] as const;

export default function OnboardingScreen() {
  const { markOnboardingSeen } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const page = PAGES[i];
  const last = i === PAGES.length - 1;
  const Art = page.Art;
  const artSize = Math.max(132, Math.min(200, Math.round(height * 0.26)));

  const goNextScreen = async () => {
    await markOnboardingSeen();
    if (isAndroidNative() && isMoneyCaptureEnabled()) {
      const asked = await getString(STORAGE_KEYS.captureSetup);
      if (asked !== 'true') {
        router.replace('/');
        return;
      }
    }
    router.replace('/');
  };

  const skip = async () => {
    await goNextScreen();
  };

  const next = async () => {
    void Haptics.selectionAsync();
    if (last) {
      await skip();
      return;
    }
    setI((n) => n + 1);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.top}>
        <BrandLockup size={32} />
        <PressScale onPress={() => void skip()} hitSlop={10} accessibilityLabel="Passer">
          <Text style={styles.skip}>Passer</Text>
        </PressScale>
      </View>

      <Animated.View
        key={page.key}
        entering={FadeIn.duration(motion.fade).delay(80)}
        exiting={FadeOut.duration(320)}
        style={styles.body}>
        <View style={styles.art}>
          <Art size={artSize} />
        </View>
        <Text style={styles.title}>{page.title}</Text>
        <Text style={styles.copy}>{page.body}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((p, idx) => (
            <View key={p.key} style={[styles.dot, idx === i && styles.dotOn]} />
          ))}
        </View>
        <Button label={last ? 'Commencer' : 'Continuer'} onPress={() => void next()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background, paddingHorizontal: 24 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { fontFamily: font.sansMed, fontSize: 15, color: color.textSecondary },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  art: { marginBottom: 12, alignItems: 'center' },
  title: { ...typeScale.h2, color: color.text, textAlign: 'center', marginBottom: 10 },
  copy: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: { gap: 16, paddingTop: 8 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: color.border },
  dotOn: { backgroundColor: color.primary, width: 22, borderRadius: 4 },
});
