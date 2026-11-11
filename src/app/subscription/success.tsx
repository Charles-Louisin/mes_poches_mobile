import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { subscriptionApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { formatPremiumUntil } from '@/lib/subscription';
import { color, type as font } from '@/theme/tokens';

type Phase = 'wait' | 'ok' | 'pending' | 'failed' | 'error';

/** Le paiement mobile money peut prendre quelques secondes après validation : on revérifie un moment. */
const POLL_DELAYS_MS = [0, 2500, 4000, 6000, 8000, 10000, 15000];

export default function PaymentSuccessScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const { refreshMe } = useAuth();
  const [phase, setPhase] = useState<Phase>('wait');
  const [detail, setDetail] = useState('');
  const run = useRef(0);

  const check = useCallback(async () => {
    if (!transactionId) {
      setPhase('error');
      setDetail('Référence de paiement manquante.');
      return;
    }
    const id = ++run.current;
    setPhase('wait');
    setDetail('');
    for (const delay of POLL_DELAYS_MS) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (id !== run.current) return;
      try {
        const res = await subscriptionApi.verifyPayment(transactionId);
        // Seul le statut de CE paiement compte : un utilisateur en essai est déjà isPremium.
        if (res.status === 'completed') {
          await refreshMe();
          setPhase('ok');
          setDetail(res.premiumUntil ? `Votre forfait est actif jusqu’au ${formatPremiumUntil(res.premiumUntil)}.` : 'Votre forfait est actif.');
          return;
        }
        if (res.status === 'failed') {
          setPhase('failed');
          setDetail('Le paiement n’a pas abouti. Aucun montant n’a été prélevé pour ce forfait.');
          return;
        }
      } catch (err) {
        if (id !== run.current) return;
        setPhase('error');
        setDetail(err instanceof Error ? err.message : 'Vérification impossible');
        return;
      }
    }
    setPhase('pending');
    setDetail('Votre opérateur n’a pas encore confirmé. Si vous avez validé sur votre téléphone, l’activation arrive d’elle-même dans quelques minutes.');
  }, [refreshMe, transactionId]);

  useEffect(() => {
    void check();
    return () => {
      run.current++;
    };
  }, [check]);

  const title =
    phase === 'wait' ? 'Vérification du paiement…' : phase === 'ok' ? 'Paiement reçu.' : phase === 'pending' ? 'En attente de confirmation' : phase === 'failed' ? 'Paiement non abouti' : 'Vérification impossible';

  return (
    // Bord bas protégé : les boutons restent au-dessus de la barre de navigation Android.
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Paiement" back />
      {phase === 'wait' ? <ActivityIndicator color={color.primary} style={styles.spinner} /> : null}
      <Text style={[styles.title, phase === 'ok' && { color: color.success }]}>{title}</Text>
      <Text style={styles.body}>{detail}</Text>
      <View style={styles.actions}>
        {phase === 'pending' || phase === 'error' ? (
          <Button label="Vérifier à nouveau" variant="secondary" onPress={() => void check()} />
        ) : null}
        {phase === 'failed' ? (
          <Button label="Réessayer le paiement" variant="secondary" onPress={() => router.replace('/subscription')} />
        ) : null}
        <Button label="Retour à l’accueil" onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spinner: { alignSelf: 'flex-start', marginBottom: 16 },
  title: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text, marginBottom: 12 },
  body: { fontFamily: font.sans, fontSize: 16, color: color.textSecondary, lineHeight: 24 },
  // Juste sous le message, à portée de pouce, jamais collés au bas de l'écran.
  actions: { marginTop: 32, gap: 12, paddingBottom: 16 },
});
