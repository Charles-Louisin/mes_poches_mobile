import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { flushOfflineQueue } from '@/lib/offline-queue';
import { isOnline, subscribeOnline } from '@/lib/network';
import { invalidateFinance } from '@/lib/query';
import { Button } from './button';
import { color, radius, type as font } from '@/theme/tokens';

/**
 * Écran plein « Pas de connexion ». Mes Poches a besoin du réseau : plutôt qu'un mode hors ligne
 * partiel (données périmées, saisies en attente), on l'indique clairement et on reprend dès le retour du réseau.
 * Les SMS mobile money captés pendant la coupure sont gardés par le module natif et envoyés à la reconnexion.
 */
export function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const wasOffline = useRef(false);

  const backOnline = useCallback(() => {
    void flushOfflineQueue();
    void invalidateFinance();
  }, []);

  useEffect(() => {
    void isOnline().then((now) => {
      setOnline(now);
      wasOffline.current = !now;
      if (now) void flushOfflineQueue();
    });
    return subscribeOnline((now) => {
      setOnline(now);
      if (now && wasOffline.current) backOnline();
      wasOffline.current = !now;
    });
  }, [backOnline]);

  const retry = async () => {
    setChecking(true);
    const now = await isOnline();
    setChecking(false);
    setOnline(now);
    if (now && wasOffline.current) backOnline();
    wasOffline.current = !now;
  };

  if (online) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive">
      <View style={styles.body}>
        <View style={styles.icon}>
          <WifiOff color={color.primary} size={34} strokeWidth={1.8} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Pas de connexion
        </Text>
        <Text style={styles.copy}>
          Vérifiez vos données mobiles ou votre Wi-Fi, puis réessayez.
        </Text>
        <Text style={styles.note}>
          Les notifications Mobile Money reçues pendant la coupure sont gardées et ajoutées au retour du réseau.
        </Text>
      </View>
      <Button label="Réessayer" loadingLabel="Vérification…" onPress={() => void retry()} loading={checking} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: color.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: {
    width: 80,
    height: 80,
    borderRadius: radius.largeCard,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontFamily: font.display, fontSize: 26, lineHeight: 32, color: color.text, textAlign: 'center' },
  copy: {
    fontFamily: font.sans,
    fontSize: 16,
    lineHeight: 24,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 340,
  },
  note: {
    fontFamily: font.sans,
    fontSize: 13,
    lineHeight: 19,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: 18,
    maxWidth: 320,
  },
});
