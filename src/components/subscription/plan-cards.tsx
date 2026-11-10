import { Card } from '@/components/ui/card';
import { TIER_DEFS, type PaidTier, type SubscriptionTier } from '@/lib/planLimits';
import { isTierBelowActive } from '@/lib/subscription';
import { color, type as font } from '@/theme/tokens';
import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

const PAID: PaidTier[] = ['pro', 'pro_plus', 'business'];

const PITCH: Record<PaidTier, string> = {
  pro: 'Pour le suivi au quotidien.',
  pro_plus: 'Pour les gros volumes et les exports.',
  business: 'Pour un commerce, une association ou une équipe.',
};

export function PlanCards({
  selected,
  activeTier = null,
  onSelect,
}: {
  selected?: SubscriptionTier;
  /** Forfait payé en cours : les paliers inférieurs ne sont pas achetables. */
  activeTier?: PaidTier | null;
  onSelect: (tier: PaidTier) => void;
}) {
  return (
    <View style={styles.wrap}>
      {PAID.map((id) => {
        const plan = TIER_DEFS[id];
        const current = activeTier === id;
        const locked = isTierBelowActive(id, activeTier);
        const on = selected === id || current;
        return (
          <Card
            key={id}
            onPress={locked ? undefined : () => onSelect(id)}
            accessibilityLabel={`${plan.label}, ${plan.priceXaf} francs CFA par mois${current ? ', votre forfait actuel' : locked ? ', indisponible pendant votre forfait actuel' : ''}`}
            style={[styles.card, on && styles.cardOn, locked && styles.cardLocked]}>
            <View style={styles.head}>
              <Text style={styles.label}>{plan.label}</Text>
              {current ? (
                <Text style={styles.badge}>Votre forfait</Text>
              ) : null}
            </View>
            <Text style={styles.pitch}>{PITCH[id]}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{plan.priceXaf.toLocaleString('fr-FR')}</Text>
              <Text style={styles.currency}> FCFA / mois</Text>
            </View>
            <View style={styles.perks}>
              {plan.perks.map((perk) => (
                <View key={perk} style={styles.perk}>
                  <Check color={locked ? color.textMuted : color.primary} size={15} strokeWidth={2.4} />
                  <Text style={styles.perkT}>{perk}</Text>
                </View>
              ))}
            </View>
            {current ? <Text style={styles.foot}>Touchez pour prolonger.</Text> : null}
            {locked ? <Text style={styles.foot}>Inclus dans votre forfait actuel.</Text> : null}
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
  cardLocked: { opacity: 0.55 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontFamily: font.sansBold, fontSize: 22, color: color.text },
  badge: {
    fontFamily: font.sansSemi,
    fontSize: 12,
    color: color.primaryDark,
    backgroundColor: color.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pitch: { fontFamily: font.sans, fontSize: 14, color: color.textSecondary, marginTop: 2, marginBottom: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  price: { fontFamily: font.sansBold, fontSize: 28, color: color.text, fontVariant: ['tabular-nums'] },
  currency: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary, marginBottom: 4 },
  perks: { gap: 6 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkT: { fontFamily: font.sans, fontSize: 14, color: color.textSecondary, flex: 1 },
  foot: { fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary, marginTop: 12 },
});
