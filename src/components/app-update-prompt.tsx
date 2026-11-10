import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { defaultUpdateMessage, otaUpdatesActive } from '@/lib/app-updates';
import { getJson, setJson } from '@/lib/storage';
import { checkApkUpdate, dismissApkUpdate, type ApkUpdate } from '@/lib/app-version';
import { ApkUpdateModal } from '@/components/apk-update-modal';
import { Button } from '@/components/ui/button';
import { color, radius, type as font } from '@/theme/tokens';

/**
 * Détection fiable des mises à jour :
 *  1. Nouvel APK (nouveau build) → modal de téléchargement avec guide Play Protect (prioritaire).
 *  2. Mise à jour OTA (expo-updates) :
 *     - expo-updates la télécharge souvent en arrière-plan au lancement (checkAutomatically ON_LOAD)
 *       mais ne l'applique qu'au prochain démarrage à froid : `useUpdates()` le voit tout de suite
 *       (isUpdatePending) et on propose simplement de redémarrer ;
 *     - on revérifie à chaque retour au premier plan (au plus toutes les 15 min), pas seulement au lancement ;
 *     - « Plus tard » n'efface la proposition que 24 h (avant : définitivement pour cette version).
 */
const DISMISS_KEY = 'mp_ota_dismissed';
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const RECHECK_MS = 15 * 60 * 1000;

type Snooze = { id: string; at: number };

function updateIdOf(info: { updateId?: string } | undefined): string {
  return info?.updateId ?? 'unknown';
}

function messageOf(info: { manifest?: unknown } | undefined): string {
  const m = info?.manifest as { metadata?: { message?: string } } | undefined;
  return defaultUpdateMessage(m?.metadata?.message);
}

export function AppUpdatePrompt() {
  if (Platform.OS === 'web' || !otaUpdatesActive()) return <ApkOnlyPrompt />;
  return <OtaAndApkPrompt />;
}

/** Web / build de dev : seul le contrôle APK s'applique (Android). */
function ApkOnlyPrompt() {
  const apk = useApkCheck();
  return apk.node;
}

function useApkCheck() {
  const [apk, setApk] = useState<ApkUpdate | null>(null);
  const run = useCallback(async () => {
    const build = await checkApkUpdate();
    if (build) setApk(build);
    return !!build;
  }, []);
  useEffect(() => {
    void run();
  }, [run]);
  const node = apk ? (
    <ApkUpdateModal
      update={apk}
      onLater={() => {
        void dismissApkUpdate(apk.latestVersion);
        setApk(null);
      }}
    />
  ) : null;
  return { node, hasApk: !!apk, run };
}

function OtaAndApkPrompt() {
  const apk = useApkCheck();
  const runApk = apk.run; // useCallback stable : évite de relancer l'effet à chaque rendu
  const { isUpdateAvailable, isUpdatePending, availableUpdate, downloadedUpdate, isDownloading } = Updates.useUpdates();
  const [snooze, setSnooze] = useState<Snooze | null>(null);
  const [snoozeLoaded, setSnoozeLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    void getJson<Snooze>(DISMISS_KEY).then((s) => {
      setSnooze(s);
      setSnoozeLoaded(true);
    });
  }, []);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < RECHECK_MS) return;
    lastCheck.current = Date.now();
    if (await runApk()) return;
    try {
      const res = await Updates.checkForUpdateAsync();
      // Téléchargement anticipé : quand l'utilisateur accepte, le redémarrage est immédiat.
      if (res.isAvailable) await Updates.fetchUpdateAsync();
    } catch {
      /* hors ligne, limite de débit : on réessaiera au prochain retour au premier plan */
    }
  }, [runApk]);

  useEffect(() => {
    const t = setTimeout(() => void check(), 1500);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [check]);

  if (apk.hasApk) return apk.node;

  const info = downloadedUpdate ?? availableUpdate;
  const id = updateIdOf(info);
  const snoozed = snooze && snooze.id === id && Date.now() - snooze.at < SNOOZE_MS;
  if (!snoozeLoaded || (!isUpdateAvailable && !isUpdatePending) || snoozed) return null;

  const later = async () => {
    const next = { id, at: Date.now() };
    setSnooze(next);
    await setJson(DISMISS_KEY, next);
  };

  const install = async () => {
    setBusy(true);
    try {
      if (!isUpdatePending) await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setBusy(false);
    }
  };

  const ready = isUpdatePending;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => void later()}>
      <Pressable style={styles.backdrop} onPress={() => void later()} accessibilityLabel="Fermer" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{ready ? 'Mise à jour prête' : 'Mise à jour disponible'}</Text>
          <Text style={styles.body}>{messageOf(info)}</Text>
          <Text style={styles.hint}>
            {ready
              ? 'Elle est déjà téléchargée : l’application redémarre en quelques secondes, vos données restent intactes.'
              : 'Téléchargement rapide, puis redémarrage de l’application. Vos données restent intactes.'}
          </Text>
          {busy || isDownloading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={color.primary} />
              <Text style={styles.loadingT}>{ready ? 'Redémarrage…' : 'Téléchargement…'}</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button label={ready ? 'Redémarrer maintenant' : 'Mettre à jour'} onPress={() => void install()} />
              <Button label="Plus tard" variant="line" onPress={() => void later()} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,17,0.45)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: color.white, borderRadius: radius.largeCard, padding: 22, gap: 12 },
  title: { fontFamily: font.sansBold, fontSize: 22, color: color.text },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.textSecondary },
  hint: { fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.textMuted },
  actions: { gap: 10, marginTop: 6 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingT: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary },
});
