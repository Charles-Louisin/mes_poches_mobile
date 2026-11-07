import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, Smartphone } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/contexts/toast';
import {
  canUseMoneyCapture,
  getSmsListenerStatus,
  isAndroidNative,
  isMoneyCaptureEnabled,
  openSmsNotificationSettings,
  rebindSmsListener,
} from '@/lib/sms-monitor';
import { color, type as font } from '@/theme/tokens';

type ListenerStatus = { enabled: boolean; connected: boolean };

export function SmsPermissionSettings() {
  const toast = useToast();
  const [listener, setListener] = useState<ListenerStatus>({ enabled: false, connected: false });
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await rebindSmsListener();
      setListener(await getSmsListenerStatus());
    } catch {
      setListener({ enabled: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMoneyCaptureEnabled()) {
      setLoading(false);
      return;
    }
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!isAndroidNative() || !isMoneyCaptureEnabled()) {
    return null;
  }

  if (!canUseMoneyCapture()) {
    return (
      <Card>
        <View style={styles.head}>
          <Smartphone color={color.primary} size={18} />
          <Text style={styles.title}>Détection Mobile Money</Text>
        </View>
        <Text style={styles.body}>
          Disponible sur la version Play Store. Scannez un ticket ou dictez une transaction en attendant.
        </Text>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <View style={styles.head}>
          <ActivityIndicator color={color.primary} />
          <Text style={styles.body}>Vérification de l’accès…</Text>
        </View>
      </Card>
    );
  }

  const activateNotifications = async () => {
    setChecking(true);
    try {
      await openSmsNotificationSettings();
      toast('Cochez MES POCHES, puis revenez ici', 'info');
      setTimeout(() => void refresh(), 2000);
    } catch {
      toast('Impossible d’ouvrir les paramètres', 'err');
    } finally {
      setChecking(false);
    }
  };

  const listenerOk = listener.enabled && listener.connected;

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <View style={styles.row}>
          <View style={styles.head}>
            <Smartphone color={color.primary} size={18} />
            <Text style={styles.title}>Détection Mobile Money</Text>
          </View>
          {listenerOk ? (
            <View style={styles.badgeOk}>
              <CheckCircle2 color={color.success} size={14} />
              <Text style={styles.ok}>Activée</Text>
            </View>
          ) : (
            <View style={styles.badgeOff}>
              <AlertCircle color={color.textMuted} size={14} />
              <Text style={styles.off}>Désactivée</Text>
            </View>
          )}
        </View>
        <Text style={styles.body}>
          {listenerOk
            ? 'Les notifications des apps de transfert, banques et Messages sont captées automatiquement.'
            : 'Autorisez l’accès aux notifications, puis cochez MES POCHES.'}
        </Text>
      </Card>

      <Button
        label="Autoriser l’accès aux notifications"
        variant={listenerOk ? 'secondary' : 'primary'}
        loadingLabel="Ouverture…"
        onPress={() => void activateNotifications()}
        loading={checking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  body: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 8, lineHeight: 19 },
  badgeOk: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeOff: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ok: { fontFamily: font.sansMed, fontSize: 12, color: color.success },
  off: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
});
