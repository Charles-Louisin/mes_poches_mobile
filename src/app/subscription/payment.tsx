import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { subscriptionApi } from '@/lib/api';
import { SUBSCRIPTION_PLANS, type BillingPeriod } from '@/lib/planLimits';
import { isSubscriptionPaymentEnabled } from '@/lib/subscription';
import { useToast } from '@/contexts/toast';
import { PlanCards } from '@/components/subscription/plan-cards';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { PressScale } from '@/components/ui/press-scale';
import { color, type as font } from '@/theme/tokens';

const METHODS = [
  { id: 'all' as const, label: 'Toutes' },
  { id: 'orange' as const, label: 'Orange Money' },
  { id: 'mtn' as const, label: 'MTN MoMo' },
];

export default function PaymentScreen() {
  const { period } = useLocalSearchParams<{ period?: string }>();
  const toast = useToast();
  const [billing, setBilling] = useState<BillingPeriod>(period === 'yearly' ? 'yearly' : 'monthly');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('all');
  const [loading, setLoading] = useState(false);
  const plan = SUBSCRIPTION_PLANS[billing];

  const pay = async () => {
    if (!isSubscriptionPaymentEnabled()) {
      toast('Le règlement en ligne n’est pas encore ouvert.', 'info');
      return;
    }
    setLoading(true);
    try {
      const { paymentUrl, transactionId } = await subscriptionApi.createCheckout(billing, method);
      await WebBrowser.openBrowserAsync(paymentUrl);
      router.replace(`/subscription/success?transactionId=${encodeURIComponent(transactionId)}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Paiement impossible', 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Règlement" back />
      <Text style={styles.lede}>Choisissez votre formule, puis le canal de paiement.</Text>
      <PlanCards selected={billing} onSelect={setBilling} />
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
        label={`Payer ${plan.priceXaf.toLocaleString('fr-FR')} XAF`}
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
