import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { subscriptionApi } from '@/lib/api';
import type { BillingPeriod } from '@/lib/planLimits';
import { formatPremiumUntil, getTrialDaysLeft, isSubscriptionPaymentEnabled } from '@/lib/subscription';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { PlanCards } from '@/components/subscription/plan-cards';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

export default function SubscriptionScreen() {
  const { user, isPremium, isOnTrial } = useAuth();
  const toast = useToast();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => subscriptionApi.getPlans() });

  const choose = (period: BillingPeriod) => {
    if (!isSubscriptionPaymentEnabled()) {
      toast('Le paiement en ligne arrive bientôt.', 'info');
      return;
    }
    track('click', { screen: 'subscription', props: { element: period } });
    router.push(`/subscription/payment?period=${period}`);
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Premium" back />
      <Text style={styles.lede}>
        {isOnTrial
          ? `Essai · encore ${getTrialDaysLeft(user)} jours.`
          : isPremium
            ? `Actif jusqu’au ${formatPremiumUntil(user?.premiumUntil)}.`
            : 'Deux formules. Même Premium. Choisissez le rythme qui vous convient.'}
      </Text>
      <PlanCards onSelect={choose} />
      {plans.data?.message ? <Text style={styles.note}>{plans.data.message}</Text> : null}
      <View style={{ height: 8 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    fontFamily: font.sans,
    fontSize: 16,
    color: color.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  note: { marginTop: 12, fontFamily: font.sans, color: color.textMuted, fontSize: 12 },
});
