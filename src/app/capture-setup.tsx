import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth';
import { BrandLockup } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import {
  getSmsListenerStatus,
  isMoneyCaptureEnabled,
  openSmsNotificationSettings,
  rebindSmsListener,
} from '@/lib/sms-monitor';
import { color, type as font, typeScale } from '@/theme/tokens';

type ListenerStatus = { enabled: boolean; connected: boolean };

export default function CaptureSetupScreen() {
  const insets = useSafeAreaInsets();
  const { markCaptureSetupSeen } = useAuth();
  const [busy, setBusy] = useState(false);
  const [listener, setListener] = useState<ListenerStatus>({ enabled: false, connected: false });
  const captureOn = isMoneyCaptureEnabled();

  const finish = async () => {
    await markCaptureSetupSeen();
    router.replace('/');
  };

  const refresh = useCallback(async () => {
    if (!isMoneyCaptureEnabled()) return;
    await rebindSmsListener();
    setListener(await getSmsListenerStatus());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !captureOn) {
      void finish();
      return;
    }
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [captureOn, refresh]);

  const askNotifications = async () => {
    setBusy(true);
    try {
      await openSmsNotificationSettings();
    } finally {
      setBusy(false);
      setTimeout(() => void refresh(), 800);
    }
  };

  if (Platform.OS !== 'android' || !captureOn) {
    return null;
  }

  const listenerOk = listener.enabled && listener.connected;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <BrandLockup size={32} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Détection Mobile Money</Text>
        <Text style={styles.lede}>
          Quand une notification Orange Money, MTN ou banque arrive, Mes Poches peut vous proposer une transaction. Vous
          confirmez avant tout enregistrement.
        </Text>

        <View style={styles.status}>
          <Text style={styles.statusLabel}>Accès aux notifications</Text>
          <Text style={[styles.statusValue, listenerOk ? styles.ok : styles.off]}>
            {listenerOk ? 'Activé' : 'Pas encore activé'}
          </Text>
        </View>

        <View style={styles.help}>
          <Text style={styles.helpTitle}>Une étape</Text>
          <Text style={styles.helpStep}>
            Appuyez sur Autoriser, puis cochez MES POCHES dans la liste, comme pour la caméra ou le micro.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Autoriser l’accès aux notifications"
          loadingLabel="Ouverture…"
          onPress={() => void askNotifications()}
          loading={busy}
        />
        <Button label="Plus tard" variant="ghost" onPress={() => void finish()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background, paddingHorizontal: 24 },
  scroll: { flex: 1, marginTop: 8 },
  scrollInner: { paddingBottom: 16 },
  title: { ...typeScale.h2, color: color.text, marginTop: 20 },
  lede: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.textSecondary,
    marginTop: 10,
  },
  status: {
    marginTop: 18,
    borderRadius: 14,
    padding: 14,
    backgroundColor: color.primaryLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statusLabel: { fontFamily: font.sansMed, fontSize: 13, color: color.text, flex: 1 },
  statusValue: { fontFamily: font.sansSemi, fontSize: 13 },
  ok: { color: color.success },
  off: { color: color.textMuted },
  help: {
    marginTop: 16,
    backgroundColor: color.primaryLight,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  helpTitle: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  helpStep: { fontFamily: font.sansMed, fontSize: 14, lineHeight: 21, color: color.text },
  footer: { gap: 8, paddingTop: 8 },
});
