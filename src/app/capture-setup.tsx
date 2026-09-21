import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, MessageSquare, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth';
import { BrandLockup } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  openSmsNotificationSettings,
  requestSmsPermission,
} from '@/lib/sms-monitor';
import { color, type as font, typeScale } from '@/theme/tokens';

export default function CaptureSetupScreen() {
  const insets = useSafeAreaInsets();
  const { markCaptureSetupSeen } = useAuth();
  const [smsDone, setSmsDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await markCaptureSetupSeen();
    router.replace('/');
  };

  const askSms = async () => {
    setBusy(true);
    try {
      await requestSmsPermission();
      setSmsDone(true);
    } finally {
      setBusy(false);
    }
  };

  const askNotifications = async () => {
    setBusy(true);
    try {
      await openSmsNotificationSettings();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') {
      void finish();
    }
  }, []);

  if (Platform.OS !== 'android') {
    return null;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <BrandLockup size={32} />
      <Text style={styles.title}>Détection Mobile Money</Text>
      <Text style={styles.lede}>
        Mes Poches lit uniquement les SMS et notifications d’argent (Orange, MTN, banques). Aucun envoi, aucune
        modification, jamais WhatsApp ni Gmail.
      </Text>

      <View style={styles.stack}>
        <Card>
          <View style={styles.row}>
            <MessageSquare color={color.primary} size={20} />
            <Text style={styles.cardT}>SMS</Text>
          </View>
          <Text style={styles.cardB}>
            Android affiche « envoyer et afficher des SMS » : c’est le libellé système du groupe SMS. L’app ne
            demande pas l’envoi, seulement la lecture des messages Mobile Money.
          </Text>
        </Card>
        <Card>
          <View style={styles.row}>
            <Bell color={color.primary} size={20} />
            <Text style={styles.cardT}>Notifications des apps</Text>
          </View>
          <Text style={styles.cardB}>
            Android n’autorise pas ce droit à l’installation. Activez MES POCHES dans la liste qui s’ouvre, puis
            revenez.
          </Text>
        </Card>
        <Card>
          <View style={styles.row}>
            <Shield color={color.primary} size={20} />
            <Text style={styles.cardT}>Lecture seule</Text>
          </View>
          <Text style={styles.cardB}>Rien n’est enregistré dans vos poches sans votre validation.</Text>
        </Card>
      </View>

      <View style={styles.footer}>
        {!smsDone ? (
          <Button
            label="Autoriser la lecture SMS"
            loadingLabel="Demande…"
            onPress={() => void askSms()}
            loading={busy}
          />
        ) : (
          <Button
            label="Activer l’accès aux notifications"
            loadingLabel="Ouverture…"
            onPress={() => void askNotifications()}
            loading={busy}
          />
        )}
        <Button label="Continuer" variant="ghost" onPress={() => void finish()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background, paddingHorizontal: 24 },
  title: { ...typeScale.h2, color: color.text, marginTop: 28 },
  lede: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.textSecondary,
    marginTop: 10,
  },
  stack: { flex: 1, gap: 12, marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardT: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  cardB: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 8, lineHeight: 19 },
  footer: { gap: 8 },
});
