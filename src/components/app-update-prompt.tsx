import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  applyAppUpdate,
  checkForAppUpdate,
  defaultUpdateMessage,
  downloadAppUpdate,
  otaUpdatesActive,
} from '@/lib/app-updates';
import { getString, setString, STORAGE_KEYS } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { color, radius, type as font } from '@/theme/tokens';

type PendingUpdate = {
  updateId: string;
  message: string;
};

export function AppUpdatePrompt() {
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const checked = useRef(false);

  const runCheck = useCallback(async () => {
    if (Platform.OS === 'web' || !otaUpdatesActive()) return;
    const info = await checkForAppUpdate();
    if (!info.available || !info.updateId) return;
    const dismissed = await getString(STORAGE_KEYS.updateDismissedId);
    if (dismissed === info.updateId) return;
    setPending({
      updateId: info.updateId,
      message: defaultUpdateMessage(info.message),
    });
  }, []);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const t = setTimeout(() => void runCheck(), 1200);
    return () => clearTimeout(t);
  }, [runCheck]);

  const dismiss = async () => {
    if (pending) await setString(STORAGE_KEYS.updateDismissedId, pending.updateId);
    setPending(null);
  };

  const install = async () => {
    setBusy(true);
    try {
      const ok = await downloadAppUpdate();
      if (ok) await applyAppUpdate();
      else setPending(null);
    } catch {
      setBusy(false);
    }
  };

  if (!pending) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => void dismiss()}>
      <Pressable style={styles.backdrop} onPress={() => void dismiss()} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.title}>Mise à jour disponible</Text>
          <Text style={styles.body}>{pending.message}</Text>
          <Text style={styles.hint}>
            Vous pourrez aussi l’installer plus tard via Réglages → Mise à jour.
          </Text>
          {busy ? (
            <View style={styles.loading}>
              <ActivityIndicator color={color.primary} />
              <Text style={styles.loadingT}>Téléchargement…</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button label="Mettre à jour" onPress={() => void install()} />
              <Button label="Plus tard" variant="line" onPress={() => void dismiss()} />
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
  card: {
    backgroundColor: color.white,
    borderRadius: radius.largeCard,
    padding: 22,
    gap: 12,
  },
  title: { fontFamily: font.sansBold, fontSize: 22, color: color.text },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.textSecondary },
  hint: { fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.textMuted },
  actions: { gap: 10, marginTop: 6 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingT: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary },
});
