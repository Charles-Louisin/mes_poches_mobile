import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth';
import { BrandLockup } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { PressScale } from '@/components/ui/press-scale';
import { getPrivacyUrl } from '@/lib/api-config';
import { isPlayBuild } from '@/lib/distribution';
import {
  getSmsListenerStatus,
  isMoneyCaptureEnabled,
  markCaptureDeclined,
  onCaptureGranted,
  openRestrictedSettings,
  openSmsNotificationSettings,
  rebindSmsListener,
} from '@/lib/sms-monitor';
import { color, type as font, typeScale } from '@/theme/tokens';

type ListenerStatus = { enabled: boolean; connected: boolean };

export default function CaptureSetupScreen() {
  const insets = useSafeAreaInsets();
  const { markCaptureSetupSeen, token } = useAuth();
  const asked = useRef(false);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listener, setListener] = useState<ListenerStatus>({ enabled: false, connected: false });
  const captureOn = isMoneyCaptureEnabled();

  const finish = async () => {
    await markCaptureSetupSeen();
    router.replace('/');
  };

  /** Continuer sans la détection : rien n'est forcé, la fonctionnalité reste coupée sur le téléphone. */
  const skip = async () => {
    await markCaptureDeclined();
    await finish();
  };

  const refresh = useCallback(async () => {
    if (!isMoneyCaptureEnabled()) return;
    try {
      await rebindSmsListener();
      const status = await getSmsListenerStatus();
      setListener(status);
      if (status.enabled) {
        setRefused(false);
        await onCaptureGranted(token);
      } else if (asked.current) {
        // Retour des réglages sans accord (refus ou « paramètre restreint ») : on n'insiste pas.
        setRefused(true);
        await markCaptureDeclined();
      }
    } catch {
      setListener({ enabled: false, connected: false });
    }
  }, [token]);

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
      asked.current = true;
      const opened = await openSmsNotificationSettings();
      if (!opened) setRefused(true);
    } finally {
      setBusy(false);
      setTimeout(() => void refresh(), 800);
    }
  };

  if (Platform.OS !== 'android' || !captureOn) {
    return null;
  }

  const listenerOk = listener.enabled && listener.connected;
  // Android 13+ : une app installée hors Play Store voit l'accès aux notifications « restreint » tant que
  // l'utilisateur n'a pas autorisé les paramètres restreints (Infos de l'appli → ⋮).
  const restrictedPossible = typeof Platform.Version === 'number' && Platform.Version >= 33;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <BrandLockup size={32} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Détection Mobile Money</Text>
        <Text style={styles.lede}>
          Quand une notification Orange Money, MTN ou banque arrive, Mes Poches peut vous proposer une transaction. Vous
          confirmez avant tout enregistrement.
        </Text>

        {/* Divulgation exigée par Google Play avant l'accès aux notifications. */}
        <View style={styles.help}>
          <Text style={styles.helpTitle}>Ce que Mes Poches lit et envoie</Text>
          <Text style={styles.helpStep}>
            Avec votre accord, l’application lit le texte des notifications reçues sur ce téléphone (SMS des opérateurs,
            applications Mobile Money et bancaires) pour y repérer un paiement.
          </Text>
          <Text style={styles.helpStep}>
            Seuls les messages liés à un mouvement d’argent (opérateur, banque, montant) sont envoyés à nos serveurs,
            de façon chiffrée, pour en extraire le montant, la date et l’opérateur ; ceux sans identifiant de
            transaction sont aussitôt écartés. Les autres notifications restent sur le téléphone.
          </Text>
          <Text style={styles.helpStep}>
            Ces données servent uniquement à vous proposer des transactions à valider. Elles ne sont ni vendues ni
            utilisées pour de la publicité. Vous pouvez retirer cet accès à tout moment dans les réglages Android.
          </Text>
          <PressScale
            onPress={() => void Linking.openURL(getPrivacyUrl())}
            accessibilityRole="link"
            style={styles.privacyLink}>
            <Text style={styles.privacyLinkT}>Lire la politique de confidentialité</Text>
          </PressScale>
        </View>

        <View style={styles.status}>
          <Text style={styles.statusLabel}>Accès aux notifications</Text>
          <Text style={[styles.statusValue, listenerOk ? styles.ok : styles.off]}>
            {listener.enabled ? 'Activé' : refused ? 'Non accordé' : 'Pas encore activé'}
          </Text>
        </View>

        {refused && !listener.enabled ? (
          <View style={styles.refused}>
            <Text style={styles.helpTitle}>Pas de souci</Text>
            <Text style={styles.restrictedT}>
              La détection automatique reste désactivée et l’application fonctionne normalement : vous ajoutez vos
              opérations à la main, par photo ou par la voix. Vous pourrez l’activer plus tard depuis Plus → Détection
              mobile money.
            </Text>
          </View>
        ) : null}

        <View style={styles.help}>
          <Text style={styles.helpTitle}>Une étape</Text>
          <Text style={styles.helpStep}>
            Appuyez sur Autoriser, puis cochez MES POCHES dans la liste, comme pour la caméra ou le micro.
          </Text>
        </View>

        {restrictedPossible && !listenerOk && !isPlayBuild() ? (
          <View style={styles.restricted}>
            <Text style={styles.helpTitle}>MES POCHES est grisé ou « Paramètre restreint » ?</Text>
            <Text style={styles.restrictedT}>
              C’est normal pour une app installée hors Play Store : Android demande votre accord une seule fois.
            </Text>
            {[
              'Touchez « Ouvrir les infos de l’appli » ci-dessous.',
              'En haut à droite, touchez ⋮ puis « Autoriser les paramètres restreints ».',
              'Confirmez avec votre code ou empreinte.',
              'Revenez ici et touchez « Autoriser l’accès aux notifications ».',
            ].map((t, i) => (
              <View key={t} style={styles.rStep}>
                <Text style={styles.rN}>{i + 1}</Text>
                <Text style={styles.restrictedT}>{t}</Text>
              </View>
            ))}
            <Button label="Ouvrir les infos de l’appli" variant="line" onPress={() => void openRestrictedSettings()} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {!listener.enabled ? (
          <Button
            label={refused ? 'Réessayer d’autoriser' : 'Autoriser l’accès aux notifications'}
            loadingLabel="Ouverture…"
            onPress={() => void askNotifications()}
            loading={busy}
          />
        ) : null}
        {listener.enabled ? (
          <Button label="Continuer" variant="ghost" onPress={() => void finish()} />
        ) : (
          <Button
            label={refused ? 'Continuer sans la détection' : 'Plus tard'}
            variant="ghost"
            onPress={() => void skip()}
          />
        )}
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
  privacyLink: { alignSelf: 'flex-start', paddingVertical: 6 },
  privacyLinkT: { fontFamily: font.sansSemi, fontSize: 14, color: color.primary, textDecorationLine: 'underline' },
  footer: { gap: 8, paddingTop: 8 },
  refused: { marginTop: 14, borderRadius: 16, padding: 16, gap: 8, backgroundColor: color.surface },
  restricted: { marginTop: 14, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: color.border },
  restrictedT: { flex: 1, fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.textSecondary },
  rStep: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rN: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', lineHeight: 22, backgroundColor: color.primaryLight, color: color.primaryDark, fontFamily: font.sansSemi, fontSize: 12 },
});
