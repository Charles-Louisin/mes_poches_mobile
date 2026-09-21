import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { SUBSCRIPTION_PLANS, type BillingPeriod } from '@/lib/planLimits';
import { Card } from '@/components/ui/card';
import { color, radius, type as font } from '@/theme/tokens';

const MONTHLY_EQ = Math.round(SUBSCRIPTION_PLANS.yearly.priceXaf / 12);

const COPY: Record<
  BillingPeriod,
  { eyebrow: string; hint: string; perks: string[]; badge?: string }
> = {
  monthly: {
    eyebrow: 'Flexibilité',
    hint: 'Sans engagement · résiliable à tout moment',
    perks: ['Scan et dictée IA', 'Budgets et épargne', 'Analyses et exports'],
  },
  yearly: {
    eyebrow: 'Le plus choisi',
    hint: `${MONTHLY_EQ.toLocaleString('fr-FR')} XAF / mois · facturé une fois`,
    perks: ['Tout le plan mensuel', '2 mois offerts', 'Prix bloqué 12 mois'],
    badge: SUBSCRIPTION_PLANS.yearly.savingsLabel,
  },
};

export function PlanCards({
  selected,
  onSelect,
}: {
  selected?: BillingPeriod;
  onSelect: (period: BillingPeriod) => void;
}) {
  return (
    <View style={styles.wrap}>
      {(Object.keys(SUBSCRIPTION_PLANS) as BillingPeriod[]).map((period) => {
        const plan = SUBSCRIPTION_PLANS[period];
        const copy = COPY[period];
        const on = selected === period;
        return (
          <Card
            key={period}
            onPress={() => onSelect(period)}
            accessibilityLabel={`${plan.label}, ${plan.priceXaf} francs CFA ${plan.periodLabel}`}
            style={[styles.card, on && styles.cardOn]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
                <Text style={styles.label}>{plan.label}</Text>
              </View>
              {copy.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeT}>{copy.badge}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{plan.priceXaf.toLocaleString('fr-FR')}</Text>
              <Text style={styles.currency}> XAF</Text>
              <Text style={styles.period}>{plan.periodLabel}</Text>
            </View>
            <Text style={styles.hint}>{copy.hint}</Text>
            <View style={styles.perks}>
              {copy.perks.map((perk) => (
                <View key={perk} style={styles.perk}>
                  <Check color={color.primary} size={15} strokeWidth={2.4} />
                  <Text style={styles.perkT}>{perk}</Text>
                </View>
              ))}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 8 },
  card: {
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.white,
  },
  cardOn: {
    borderColor: color.primary,
    backgroundColor: color.primaryVeryLight,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  eyebrow: {
    fontFamily: font.sansMed,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: color.primary,
    marginBottom: 2,
  },
  label: { fontFamily: font.sansBold, fontSize: 22, color: color.text },
  badge: {
    backgroundColor: color.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeT: { fontFamily: font.sansSemi, fontSize: 11, color: color.white },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  price: { fontFamily: font.sansBold, fontSize: 34, color: color.text, letterSpacing: -0.6 },
  currency: { fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  period: { fontFamily: font.sans, fontSize: 14, color: color.textMuted, marginLeft: 4 },
  hint: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 6, marginBottom: 14 },
  perks: { gap: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkT: { fontFamily: font.sans, fontSize: 14, color: color.text, flex: 1 },
});
