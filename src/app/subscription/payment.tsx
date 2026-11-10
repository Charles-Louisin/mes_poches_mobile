import { Button } from '@/components/ui/button';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/contexts/toast';
import { subscriptionApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { TIER_DEFS, priceFor, type BillingPeriod, type PaidTier } from '@/lib/planLimits';
import { activePaidTier, isSubscriptionPaymentEnabled, isTierBelowActive } from '@/lib/subscription';
import { useAuth } from '@/contexts/auth';
import { color, radius, type as font } from '@/theme/tokens';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

/** Lien profond attendu en fin de paiement (page web de retour → mespoches://subscription/success). */
const RETURN_PATH = 'subscription/success';

function transactionIdFrom(url: string | undefined): string | null {
  if (!url) return null;
  const { queryParams } = Linking.parse(url);
  const id = queryParams?.transactionId;
  return typeof id === 'string' && id ? id : null;
}

export default function PaymentScreen() {
  const { period, tier: tierParam } = useLocalSearchParams<{ period?: string; tier?: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const tier: PaidTier = tierParam === 'pro_plus' || tierParam === 'business' ? tierParam : 'pro';
  const [billing, setBilling] = useState<BillingPeriod>(period === 'yearly' ? 'yearly' : 'monthly');
  const [loading, setLoading] = useState(false);
  const amount = priceFor(tier, billing);
  const plan = TIER_DEFS[tier];
  const active = activePaidTier(user);
  const blocked = isTierBelowActive(tier, active);

  const pay = async () => {
    if (blocked) return;
    if (!isSubscriptionPaymentEnabled()) {
      toast('Le règlement en ligne n’est pas encore ouvert.', 'info');
      return;
    }
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Web : redirection pleine page ; SasPay ramène sur /subscription/success de cette origine.
        const { paymentUrl } = await subscriptionApi.createCheckout(billing, 'all', tier, window.location.origin);
        window.location.assign(paymentUrl);
        return;
      }
      const { paymentUrl, transactionId } = await subscriptionApi.createCheckout(billing, 'all', tier);
      const result = await WebBrowser.openAuthSessionAsync(paymentUrl, Linking.createURL(RETURN_PATH));
      // Succès : la page de retour a rouvert l'app. Fermeture manuelle : on vérifie quand même côté serveur.
      const ref = result.type === 'success' ? transactionIdFrom(result.url) ?? transactionId : transactionId;
      router.replace(`/subscription/success?transactionId=${encodeURIComponent(ref)}`);
    } catch (err) {
      toast(getErrorMessage(err, 'Paiement impossible'), 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Règlement" back />
      <Text style={styles.lede}>
        {plan.label} — {amount.toLocaleString('fr-FR')} FCFA {billing === 'yearly' ? 'pour un an' : 'par mois'}.
      </Text>
      <View style={styles.row}>
        {(['monthly', 'yearly'] as BillingPeriod[]).map((id) => (
          <PressScale key={id} onPress={() => setBilling(id)} style={[styles.chip, billing === id && styles.chipOn]}>
            <Text style={[styles.chipT, billing === id && styles.chipTon]}>
              {id === 'yearly' ? `Annuel · ${priceFor(tier, 'yearly').toLocaleString('fr-FR')}` : `Mensuel · ${plan.priceXaf.toLocaleString('fr-FR')}`}
            </Text>
          </PressScale>
        ))}
      </View>

      <Text style={styles.sec}>Moyens acceptés</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobile money</Text>
        <Text style={styles.cardBody}>
          Orange Money, MTN MoMo, Wave, Moov, Airtel, M-Pesa… dans 21 pays d’Afrique. Vous choisissez votre pays et votre opérateur sur la page sécurisée.
        </Text>
        <View style={styles.divider} />
        <Text style={styles.cardTitle}>Carte bancaire</Text>
        <Text style={styles.cardBody}>Visa ou Mastercard, depuis n’importe quel pays.</Text>
      </View>
      <Text style={styles.note}>
        Les frais de l’opérateur s’ajoutent au prix et vous sont affichés avant validation. Paiement opéré par SasPay ; vous revenez automatiquement dans l’app.
      </Text>

      {blocked && active ? (
        <Text style={styles.blocked}>
          Votre forfait {TIER_DEFS[active].label} est actif. Vous pouvez le prolonger ou choisir un forfait supérieur.
        </Text>
      ) : null}
      <View style={{ height: 24 }} />
      <Button
        label={`Payer ${amount.toLocaleString('fr-FR')} FCFA`}
        loadingLabel="Ouverture du paiement…"
        onPress={() => void pay()}
        loading={loading}
        disabled={blocked}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    fontFamily: font.sans,
    fontSize: 16,
    color: color.textSecondary,
    lineHeight: 24,
    marginBottom: 18,
  },
  sec: {
    fontFamily: font.sansSemi,
    fontSize: 15,
    color: color.text,
    marginTop: 24,
    marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: color.primary, borderColor: color.primary },
  chipT: { fontFamily: font.sansMed, color: color.text, fontSize: 13 },
  chipTon: { color: color.white },
  card: {
    backgroundColor: color.primaryVeryLight,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.primaryLight,
    padding: 16,
  },
  cardTitle: { fontFamily: font.sansSemi, fontSize: 15, color: color.text, marginBottom: 4 },
  cardBody: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.textSecondary },
  divider: { height: 1, backgroundColor: color.primaryLight, marginVertical: 12 },
  blocked: {
    fontFamily: font.sansMed,
    fontSize: 14,
    lineHeight: 20,
    color: color.danger,
    marginTop: 16,
  },
  note: {
    fontFamily: font.sans,
    fontSize: 12,
    lineHeight: 18,
    color: color.textMuted,
    marginTop: 12,
  },
});
