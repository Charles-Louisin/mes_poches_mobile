import { PlanCards } from '@/components/subscription/plan-cards';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import type { PaidTier } from '@/lib/planLimits';
import { formatPremiumUntil, getTrialDaysLeft, isSubscriptionPaymentEnabled } from '@/lib/subscription';
import { track } from '@/lib/telemetry';
import { color, type as font } from '@/theme/tokens';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SubscriptionScreen() {
  const { user, isPremium, isOnTrial } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const choose = (tier: PaidTier) => {
    if (!isSubscriptionPaymentEnabled()) {
      toast('Le paiement en ligne arrive bientôt.', 'info');
      return;
    }
    track('click', { screen: 'subscription', props: { element: tier } });
    router.push(`/subscription/payment?tier=${tier}`);
  };

  const trialDays = getTrialDaysLeft(user);
  const status = isAdmin
    ? 'ADMINISTRATEUR'
    : isOnTrial
      ? `Essai Premium en cours jusqu’au ${formatPremiumUntil(user?.premiumUntil)} · ${trialDays} jour${trialDays > 1 ? 's' : ''} restant${trialDays > 1 ? 's' : ''}.`
      : isPremium
        ? `Premium jusqu’au ${formatPremiumUntil(user?.premiumUntil)}.`
        : user?.lifetime
          ? `${user.tierLabel || 'Votre forfait'} est offert, sans échéance.`
          : user?.tierLabel && user.accessTier && user.accessTier !== 'free'
            ? `Forfait ${user.tierLabel}.`
            : 'Gratuit, Pro, Pro+ ou Business. Choisissez selon votre usage.';

  return (
    <Screen scroll>
      <ScreenHeader title="Premium" back />
      <Text style={[styles.lede, (isOnTrial || isAdmin) && styles.ledeStrong]}>{status}</Text>
      <PlanCards onSelect={choose} />
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
  ledeStrong: {
    fontFamily: font.sansSemi,
    fontSize: 18,
    lineHeight: 26,
    color: color.primaryDark,
  },
});
