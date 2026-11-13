import { router } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Mic, ScanLine, type LucideIcon } from 'lucide-react-native';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { PressScale } from '@/components/ui/press-scale';
import { showQuotaPrompt } from '@/components/subscription/quota-prompt';
import { isQuotaFull } from '@/components/subscription/plan-usage';
import type { MeUser, QuotaSnap } from '@/lib/api';
import { color, radius, shadow, type as font } from '@/theme/tokens';

function Tile({ q, label, Icon, tint, bg }: { q: QuotaSnap; label: string; Icon: LucideIcon; tint: string; bg: string }) {
  const full = isQuotaFull(q);
  const unlimited = q.limit == null;
  const ratio = q.limit ? Math.min(1, q.used / q.limit) : 0;
  const open = () =>
    q.nextTier
      ? showQuotaPrompt({
          message: `${q.limit}/${q.limit} ${q.label} ce mois. Le palier ${q.nextLabel} vous en donne davantage.`,
          nextTier: q.nextTier,
          nextLabel: q.nextLabel,
          nextPriceXaf: q.nextPriceXaf,
        })
      : router.push('/subscription');

  return (
    <PressScale
      onPress={full ? open : undefined}
      disabled={!full}
      style={[styles.tile, full && styles.tileFull]}
      accessibilityLabel={`${label} : ${unlimited ? 'illimité' : `${q.used} sur ${q.limit}`} ce mois`}>
      <View style={[styles.ico, { backgroundColor: full ? '#FFF1D6' : bg }]}>
        <Icon color={full ? '#B45309' : tint} size={20} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {full ? <GoldDiamond size={12} /> : null}
        </View>
        <Text style={[styles.count, full && { color: '#92400E' }]} numberOfLines={1} adjustsFontSizeToFit>
          {unlimited ? (
            'Illimité'
          ) : (
            <>
              {Math.min(q.used, q.limit!)}
              <Text style={styles.of}>/{q.limit}</Text>
            </>
          )}
        </Text>
      </View>
      {!unlimited ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: full ? '#D97706' : tint }]} />
        </View>
      ) : null}
    </PressScale>
  );
}

/** Scans et notes vocales du mois, côte à côte sur l'accueil. */
export function QuotaTiles({ quotas }: { quotas?: MeUser['quotas'] }) {
  if (!quotas?.scans && !quotas?.voice) return null;
  return (
    <View style={styles.wrap}>
      {quotas.scans ? <Tile q={quotas.scans} label="Scans" Icon={ScanLine} tint="#C2410C" bg="#FFF4EC" /> : null}
      {quotas.voice ? <Tile q={quotas.voice} label="Notes" Icon={Mic} tint={color.primary} bg={color.primaryLight} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12, marginTop: 28, marginBottom: 4 },
  tile: {
    flex: 1,
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 16px rgba(17,17,17,0.05)' } : shadow.soft),
  },
  tileFull: { backgroundColor: '#FFF7E8' },
  ico: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flexShrink: 1, fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary },
  count: { fontFamily: font.sansBold, fontSize: 20, color: color.text, fontVariant: ['tabular-nums'] },
  of: { fontFamily: font.sansMed, fontSize: 15, color: color.textMuted },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: color.border },
  fill: { height: 3 },
});
