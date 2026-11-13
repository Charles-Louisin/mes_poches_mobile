import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { CheckCircle2, ChevronLeft, ChevronUp, Sparkles, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { useTutorial } from '@/contexts/tutorial';
import { effectiveVersion } from '@/lib/app-version';
import { getString, setString } from '@/lib/storage';
import { latestRelease, releaseFor, type Release } from '@/lib/whats-new';
import { Button } from '@/components/ui/button';
import { PressScale } from '@/components/ui/press-scale';
import { color, radius, shadow, type as font } from '@/theme/tokens';

/**
 * Après l'installation d'une nouvelle version : proposition d'une visite guidée des nouveautés,
 * puis un coach qui ouvre chaque écran concerné et explique comment s'en servir.
 */
const LAST_RUN_KEY = 'mp_last_run_version';
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Ctx = { startTour: (release?: Release) => void };
const WhatsNewCtx = createContext<Ctx>({ startTour: () => undefined });

export function useWhatsNew() {
  return useContext(WhatsNewCtx);
}

export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const { ready, token } = useAuth();
  const { active: firstTutorial } = useTutorial();
  const [offer, setOffer] = useState<Release | null>(null);
  const [tour, setTour] = useState<{ release: Release; index: number } | null>(null);

  // Détection d'une mise à jour installée : la version a changé depuis le dernier lancement.
  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        const current = await effectiveVersion();
        const last = await getString(LAST_RUN_KEY);
        await setString(LAST_RUN_KEY, current);
        // Première installation : le guide de prise en main s'en charge déjà.
        if (cancelled || !last || last === current) return;
        const release = releaseFor(current);
        if (release) setOffer(release);
      })();
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ready, token]);

  const go = useCallback((release: Release, index: number) => {
    const step = release.tour[index];
    if (!step) return;
    setTour({ release, index });
    router.navigate(step.route as never);
  }, []);

  const startTour = useCallback(
    (release?: Release) => {
      setOffer(null);
      go(release ?? latestRelease(), 0);
    },
    [go]
  );

  const value = useMemo(() => ({ startTour }), [startTour]);
  const step = tour ? tour.release.tour[tour.index] : null;

  return (
    <WhatsNewCtx.Provider value={value}>
      {children}
      {offer && !firstTutorial ? <WhatsNewOffer release={offer} onGuide={() => startTour(offer)} onLater={() => setOffer(null)} /> : null}
      {tour && step ? (
        <Coach
          key={tour.index}
          step={step}
          index={tour.index}
          total={tour.release.tour.length}
          onPrev={() => go(tour.release, tour.index - 1)}
          onNext={() => (tour.index + 1 < tour.release.tour.length ? go(tour.release, tour.index + 1) : setTour(null))}
          onClose={() => setTour(null)}
        />
      ) : null}
    </WhatsNewCtx.Provider>
  );
}

function WhatsNewOffer({ release, onGuide, onLater }: { release: Release; onGuide: () => void; onLater: () => void }) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onLater}>
      <Pressable style={styles.backdrop} onPress={onLater} accessibilityLabel="Fermer" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.badge}>
            <Sparkles color={color.primary} size={22} strokeWidth={2} />
          </View>
          <Text style={styles.title}>Version {release.version} installée</Text>
          <Text style={styles.lead}>Voici ce qui change :</Text>
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 12 }}>
            {release.highlights.map((h) => (
              <View key={h.title} style={styles.item}>
                <CheckCircle2 color={color.success} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemT}>{h.title}</Text>
                  <Text style={styles.itemB}>{h.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.question}>Voulez-vous être guidé sur ces nouveautés{'\u00a0'}?</Text>
          <View style={{ gap: 10 }}>
            <Button label="Oui, me guider" onPress={onGuide} />
            <Button label="Plus tard" variant="line" onPress={onLater} />
          </View>
          <Text style={styles.hint}>La visite reste disponible dans Plus › Nouveautés.</Text>
        </View>
      </View>
    </Modal>
  );
}

function Coach({
  step,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  step: { title: string; body: string };
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const last = index + 1 === total;
  // Réduit : une petite pastille dans un coin, tout l'écran est libre pour essayer.
  const [mini, setMini] = useState(false);

  if (mini) {
    return (
      <Animated.View
        entering={FadeInUp.duration(200).easing(EASE_OUT)}
        exiting={FadeOutUp.duration(140)}
        style={styles.pill}>
        <PressScale
          onPress={() => setMini(false)}
          style={styles.pillBtn}
          accessibilityRole="button"
          accessibilityLabel={`Afficher le guide, nouveauté ${index + 1} sur ${total}`}>
          <Sparkles color={color.white} size={14} />
          <Text style={styles.pillT}>
            Guide {index + 1}/{total}
          </Text>
          <ChevronLeft color={color.white} size={14} />
        </PressScale>
      </Animated.View>
    );
  }

  // Carte posée seule (aucune couche plein écran) : le reste de l'écran reçoit les touchers.
  return (
    <Animated.View
      entering={FadeInUp.duration(240).easing(EASE_OUT)}
      exiting={FadeOutUp.duration(160)}
      style={[styles.coach, { top: insets.top + 60 }]}
      accessibilityLiveRegion="polite">
      <View style={styles.coachHead}>
        <Text style={styles.coachStep}>
          Nouveauté {index + 1}/{total}
        </Text>
        <View style={styles.coachTools}>
          <PressScale onPress={() => setMini(true)} hitSlop={8} style={styles.tool} accessibilityRole="button" accessibilityLabel="Réduire le guide pour essayer">
            <ChevronUp color={color.white} size={16} />
            <Text style={styles.toolT}>Réduire</Text>
          </PressScale>
          <PressScale onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Quitter la visite">
            <X color="rgba(255,255,255,0.7)" size={18} />
          </PressScale>
        </View>
      </View>
      <Text style={styles.coachT}>{step.title}</Text>
      <Text style={styles.coachB}>{step.body}</Text>
      <View style={styles.coachActions}>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        {index > 0 ? (
          <PressScale onPress={onPrev} style={styles.prev} accessibilityRole="button" accessibilityLabel="Précédent">
            <Text style={styles.prevT}>Préc.</Text>
          </PressScale>
        ) : null}
        <PressScale onPress={onNext} style={styles.next} accessibilityRole="button">
          <Text style={styles.nextT}>{last ? 'Terminer' : 'Suivant'}</Text>
        </PressScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,17,0.45)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: color.white, borderRadius: radius.largeCard, padding: 22, gap: 14, maxHeight: '90%' },
  badge: { width: 48, height: 48, borderRadius: 16, backgroundColor: color.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.sansBold, fontSize: 22, lineHeight: 28, color: color.text },
  lead: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemT: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  itemB: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.textSecondary, marginTop: 2 },
  question: { fontFamily: font.sansSemi, fontSize: 15, color: color.text, marginTop: 4 },
  hint: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  coach: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#14213D',
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    ...shadow.card,
    elevation: 16,
    zIndex: 900,
  },
  coachHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coachStep: { fontFamily: font.sansSemi, fontSize: 12, color: '#9DB8F5' },
  coachTools: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 28, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  toolT: { fontFamily: font.sansSemi, fontSize: 12, color: color.white },
  coachT: { fontFamily: font.sansBold, fontSize: 16, color: color.white },
  coachB: { fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.86)' },
  coachActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dots: { flex: 1, flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 16, backgroundColor: color.white },
  prev: { minHeight: 38, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  prevT: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
  next: { minHeight: 38, paddingHorizontal: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.primary },
  nextT: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
  // Languette accrochée au bord droit, à mi-hauteur : elle ne recouvre ni l'en-tête ni les boutons du bas.
  pill: { position: 'absolute', right: 0, top: '46%', zIndex: 900, elevation: 16 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingLeft: 12, paddingRight: 10, borderTopLeftRadius: 20, borderBottomLeftRadius: 20, backgroundColor: '#14213D', ...shadow.card },
  pillT: { fontFamily: font.sansSemi, fontSize: 12, color: color.white },
});
