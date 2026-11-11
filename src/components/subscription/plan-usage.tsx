import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { PressScale } from '@/components/ui/press-scale';
import { showQuotaPrompt } from '@/components/subscription/quota-prompt';
import { useAuth } from '@/contexts/auth';
import type { QuotaSnap } from '@/lib/api';
import { color, radius, type as font } from '@/theme/tokens';

type Key = 'scans' | 'voice' | 'wallets' | 'categories';

/** « 2/3 ce mois », « 4/5 », « Illimité ». */
export function usageText(q: QuotaSnap | undefined): string {
  if (!q) return '';
  if (q.limit == null) return 'Illimité';
  return `${Math.min(q.used, q.limit)}/${q.limit}${q.period === 'month' ? ' ce mois' : ''}`;
}

export function isQuotaFull(q: QuotaSnap | undefined): boolean {
  return !!q && q.limit != null && q.used >= q.limit;
}

/**
 * Compteur d'usage du forfait, visible avant toute action.
 * Plein : ton ambre + diamant, et un appui ouvre la proposition de palier supérieur.
 */
export function PlanUsage({ kind, style }: { kind: Key; style?: object }) {
  const { user } = useAuth();
  const q = user?.quotas?.[kind];
  if (!q) return null;
  const full = isQuotaFull(q);
  const unlimited = q.limit == null;
  const over = q.limit != null && q.used > q.limit;
  const ratio = q.limit ? Math.min(1, q.used / q.limit) : 0;
  const when = q.period === 'month' ? ' ce mois-ci' : '';
  const label = unlimited
    ? `${q.label[0].toUpperCase()}${q.label.slice(1)} illimitées`
    : full
      ? over
        ? `${q.used} ${q.label} enregistrées, ${q.limit} incluses dans votre plan`
        : `Limite atteinte : ${q.limit}/${q.limit} ${q.label}${when}`
      : `${q.used}/${q.limit} ${q.label} utilisées${when}`;

  const body = (
    <View style={[styles.wrap, full && styles.wrapFull, style]}>
      <View style={styles.row}>
        {full ? <GoldDiamond size={14} /> : null}
        <Text style={[styles.text, full && styles.textFull]} numberOfLines={2}>
          {label}
        </Text>
        {full && q.nextLabel ? <Text style={styles.cta}>Passer à {q.nextLabel}</Text> : null}
      </View>
      {!unlimited ? (
        <View style={styles.track}>
          <View style={[styles.fill, full && styles.fillFull, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );

  if (!full) return body;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${label}. Voir les forfaits`}
      onPress={() =>
        q.nextTier
          ? showQuotaPrompt({
              message: `${label}. Le palier ${q.nextLabel} vous en donne davantage.`,
              nextTier: q.nextTier,
              nextLabel: q.nextLabel,
              nextPriceXaf: q.nextPriceXaf,
            })
          : router.push('/subscription')
      }>
      {body}
    </PressScale>
  );
}

/** Message affiché sur une poche ou une catégorie hors forfait. */
export function lockedMessage(kind: 'wallets' | 'categories', q: QuotaSnap | undefined): string {
  const what = kind === 'wallets' ? 'poches' : 'catégories';
  const limit = q?.limit ?? 0;
  const next = q?.nextLabel ? `Passez au palier ${q.nextLabel} pour continuer à l’utiliser.` : 'Changez de palier pour continuer à l’utiliser.';
  return `Votre plan inclut vos ${limit} premières ${what}. ${next}`;
}

/** Ouvre la proposition de palier pour une poche ou une catégorie verrouillée. */
export function promptLocked(kind: 'wallets' | 'categories', q: QuotaSnap | undefined) {
  showQuotaPrompt({
    message: lockedMessage(kind, q),
    nextTier: q?.nextTier,
    nextLabel: q?.nextLabel,
    nextPriceXaf: q?.nextPriceXaf,
  });
}

/** Pastille « diamant » posée sur un élément verrouillé. */
export function LockedTag() {
  return (
    <View style={styles.tag}>
      <GoldDiamond size={13} />
      <Text style={styles.tagT}>Palier supérieur</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    gap: 8,
  },
  wrapFull: { backgroundColor: '#FFF7E8' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary },
  textFull: { color: '#92400E' },
  cta: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
  track: { height: 4, borderRadius: 4, backgroundColor: color.border, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 4, backgroundColor: color.primary },
  fillFull: { backgroundColor: '#D97706' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: '#FFF7E8',
  },
  tagT: { fontFamily: font.sansSemi, fontSize: 11, color: '#92400E' },
});
