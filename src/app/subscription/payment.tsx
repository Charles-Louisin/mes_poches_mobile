import { Button } from '@/components/ui/button';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/contexts/toast';
import { subscriptionApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { TIER_DEFS, priceFor, type BillingPeriod, type PaidTier } from '@/lib/planLimits';
import { isSubscriptionPaymentEnabled } from '@/lib/subscription';
import { color, type as font } from '@/theme/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const METHODS = [
  { id: 'all' as const, label: 'Toutes' },
  { id: 'orange' as const, label: 'Orange Money' },
  { id: 'mtn' as const, label: 'MTN MoMo' },
];

export default function PaymentScreen() {
  const { period, tier: tierParam } = useLocalSearchParams<{ period?: string; tier?: string }>();
  const toast = useToast();
  const tier: PaidTier = tierParam === 'pro_plus' || tierParam === 'business' ? tierParam : 'pro';
  const [billing, setBilling] = useState<BillingPeriod>(period === 'yearly' ? 'yearly' : 'monthly');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('all');
  const [loading, setLoading] = useState(false);
  const amount = priceFor(tier, billing);
  const plan = TIER_DEFS[tier];

  const pay = async () => {
    if (!isSubscriptionPaymentEnabled()) {
      toast('Le règlement en ligne n’est pas encore ouvert.', 'info');
      return;
    }
    setLoading(true);
    try {
      const { paymentUrl, transactionId } = await subscriptionApi.createCheckout(billing, method, tier);
      await WebBrowser.openBrowserAsync(paymentUrl);
      router.replace(`/subscription/success?transactionId=${encodeURIComponent(transactionId)}`);
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
      <Text style={styles.sec}>Canal</Text>
      <View style={styles.row}>
        {METHODS.map((m) => (
          <PressScale key={m.id} onPress={() => setMethod(m.id)} style={[styles.chip, method === m.id && styles.chipOn]}>
            <Text style={[styles.chipT, method === m.id && styles.chipTon]}>{m.label}</Text>
          </PressScale>
        ))}
      </View>
      <View style={{ height: 24 }} />
      <Button
        label={`Payer ${amount.toLocaleString('fr-FR')} FCFA`}
        loadingLabel="Ouverture…"
        onPress={() => void pay()}
        loading={loading}
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
    fontFamily: font.sansMed,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: color.textMuted,
    marginTop: 8,
    marginBottom: 12,
  },
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
});
