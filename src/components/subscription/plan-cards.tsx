import { Card } from '@/components/ui/card';
import { TIER_DEFS, type PaidTier, type SubscriptionTier } from '@/lib/planLimits';
import { color, type as font } from '@/theme/tokens';
import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

const PAID: PaidTier[] = ['pro', 'pro_plus', 'business'];

export function PlanCards({
  selected,
  onSelect,
}: {
  selected?: SubscriptionTier;
  onSelect: (tier: PaidTier) => void;
}) {
  return (
    <View style={styles.wrap}>
      {PAID.map((id) => {
        const plan = TIER_DEFS[id];
        const on = selected === id;
        return (
          <Card
            key={id}
            onPress={() => onSelect(id)}
            accessibilityLabel={`${plan.label}, ${plan.priceXaf} francs CFA par mois`}
            style={[styles.card, on && styles.cardOn]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{id === 'pro_plus' ? 'Le plus complet' : id === 'business' ? 'Activité' : 'Usage courant'}</Text>
                <Text style={styles.label}>{plan.label}</Text>
              </View>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{plan.priceXaf.toLocaleString('fr-FR')}</Text>
              <Text style={styles.currency}> FCFA</Text>
              <Text style={styles.period}> / mois</Text>
            </View>
            <View style={styles.perks}>
              {plan.perks.map((perk) => (
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
  wrap: { gap: 12 },
  card: { padding: 16, borderWidth: 1, borderColor: color.border },
  cardOn: { borderColor: color.primary },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  eyebrow: { fontFamily: font.sansMed, fontSize: 12, color: color.primary, textTransform: 'uppercase' },
  label: { fontFamily: font.sansBold, fontSize: 22, color: color.text },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  price: { fontFamily: font.sansBold, fontSize: 28, color: color.text },
  currency: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary, marginBottom: 4 },
  period: { fontFamily: font.sans, fontSize: 14, color: color.textSecondary, marginBottom: 4 },
  perks: { gap: 6 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkT: { fontFamily: font.sans, fontSize: 14, color: color.textSecondary, flex: 1 },
});
