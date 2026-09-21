import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, Smartphone } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/contexts/toast';
import {
  canUseSmsNative,
  checkNotificationListener,
  isAndroidNative,
  isExpoGo,
  openSmsNotificationSettings,
  requestSmsPermission,
} from '@/lib/sms-monitor';
import { color, type as font } from '@/theme/tokens';

export function SmsPermissionSettings() {
  const toast = useToast();
  const [listenerEnabled, setListenerEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setListenerEnabled(await checkNotificationListener());
    } catch {
      setListenerEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isAndroidNative()) {
    return (
      <Card>
        <View style={styles.head}>
          <Smartphone color={color.textMuted} size={18} />
          <Text style={styles.title}>Détection SMS</Text>
        </View>
        <Text style={styles.body}>Disponible uniquement sur Android. Sur iOS, utilisez le scan ou la dictée.</Text>
      </Card>
    );
  }

  if (isExpoGo() || !canUseSmsNative()) {
    return (
      <Card>
        <View style={styles.head}>
          <Smartphone color={color.primary} size={18} />
          <Text style={styles.title}>Détection SMS</Text>
        </View>
        <Text style={styles.body}>
          La lecture des SMS Mobile Money demande un development build Android (pas Expo Go). Une fois l’app compilée,
          le jeton de session est transmis au récepteur natif.
        </Text>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <View style={styles.head}>
          <ActivityIndicator color={color.primary} />
          <Text style={styles.body}>Vérification des permissions…</Text>
        </View>
      </Card>
    );
  }

  const activate = async () => {
    setChecking(true);
    try {
      await requestSmsPermission();
      await openSmsNotificationSettings();
      toast('Activez SMS et l’accès aux notifications, puis revenez', 'info');
      setTimeout(() => void refresh(), 2000);
    } catch {
      toast('Impossible d’ouvrir les paramètres', 'err');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <View style={styles.row}>
          <View style={styles.head}>
            <Smartphone color={color.primary} size={18} />
            <Text style={styles.title}>Détection SMS</Text>
          </View>
          {listenerEnabled ? (
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
          {listenerEnabled
            ? 'Les SMS et les notifications des apps de transfert, banques et fintech sont captés automatiquement.'
            : 'Activez la détection pour capturer les SMS Orange Money, MTN, et les apps bancaires / fintech.'}
        </Text>
      </Card>

      {!listenerEnabled ? (
        <Button
          label="Activer la détection SMS"
          loadingLabel="Configuration…"
          onPress={() => void activate()}
          loading={checking}
        />
      ) : (
        <Button label="Gérer les permissions" variant="secondary" onPress={() => void openSmsNotificationSettings()} />
      )}
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
