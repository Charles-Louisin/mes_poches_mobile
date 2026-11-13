import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, PiggyBank } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { Amount } from './amount';
import { PressScale } from './press-scale';
import { color, radius, space, type as font, typeScale } from '@/theme/tokens';
import { useResponsive } from '@/hooks/use-responsive';

export function BalanceCard({
  amount,
  format,
  income,
  expense,
  savings,
  hidden,
  onToggleHide,
  holder,
  planLabel,
  admin,
  loading = false,
}: {
  amount: number;
  format: (n: number) => string;
  income?: number;
  expense?: number;
  savings?: number;
  hidden: boolean;
  onToggleHide: () => void;
  holder?: string;
  planLabel: string;
  admin?: boolean;
  /** Données pas encore arrivées : emplacements gris au lieu d'un faux « 0 ». */
  loading?: boolean;
}) {
  const { maxAmount, isSmall } = useResponsive();
  const name = (holder || '').trim().toUpperCase();

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#1B3A7A', '#163066', '#0E1F45']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <LinearGradient
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.orbTop} />
        <View pointerEvents="none" style={styles.orbBottom} />

        <View style={styles.top}>
          <Text style={styles.plan}>{admin ? 'ADMINISTRATEUR' : `Plan ${planLabel}`}</Text>
          <PressScale
            onPress={onToggleHide}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Afficher le solde' : 'Masquer le solde'}
            style={styles.eye}>
            {hidden ? (
              <EyeOff color={color.white} size={18} strokeWidth={2} />
            ) : (
              <Eye color={color.white} size={18} strokeWidth={2} />
            )}
          </PressScale>
        </View>

        <Text style={styles.soldeLabel}>Solde disponible</Text>
        {loading ? (
          <View style={styles.skelAmount} accessibilityLabel="Solde en cours de chargement" />
        ) : hidden ? (
          <Text style={[styles.hidden, { fontSize: isSmall ? 32 : maxAmount }]}>••••••</Text>
        ) : (
          <Amount amount={amount} format={format} size={isSmall ? 32 : maxAmount} color={color.white} />
        )}

        <View style={styles.meta}>
          <Flow
            Icon={ArrowDownLeft}
            tone="in"
            label="Entrées"
            value={loading ? '…' : hidden ? '•••' : format(income ?? 0)}
          />
          <Flow
            Icon={ArrowUpRight}
            tone="out"
            label="Sorties"
            value={loading ? '…' : hidden ? '•••' : format(expense ?? 0)}
          />
          {savings && savings > 0 ? (
            <Flow Icon={PiggyBank} tone="save" label="Épargne" value={hidden ? '•••' : format(savings)} />
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Text style={styles.holder} numberOfLines={1}>
            {name}
          </Text>
          <ChipMark />
        </View>
      </LinearGradient>
    </View>
  );
}

function Flow({
  Icon,
  tone,
  label,
  value,
}: {
  Icon: typeof ArrowDownLeft;
  tone: 'in' | 'out' | 'save';
  label: string;
  value: string;
}) {
  const bg = tone === 'in' ? 'rgba(18,183,106,0.22)' : tone === 'save' ? 'rgba(245,166,35,0.24)' : 'rgba(240,68,56,0.22)';
  const fg = tone === 'in' ? '#7DFFB3' : tone === 'save' ? '#FFD58A' : '#FFB4AE';
  return (
    <View style={styles.flow}>
      <View style={[styles.flowIcon, { backgroundColor: bg }]}>
        <Icon color={fg} size={14} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metaK}>{label}</Text>
        <Text style={styles.metaV} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ChipMark() {
  return (
    <Svg width={46} height={34} viewBox="0 0 46 34">
      <Defs>
        <SvgGradient id="chipGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F8E7B0" />
          <Stop offset="0.5" stopColor="#E2C36A" />
          <Stop offset="1" stopColor="#C9A227" />
        </SvgGradient>
      </Defs>
      <Rect x="0.5" y="0.5" width="45" height="33" rx="6" fill="url(#chipGold)" />
      <Rect x="15" y="0.5" width="16" height="33" fill="rgba(120,80,10,0.2)" />
      <Rect x="0.5" y="11.5" width="45" height="11" fill="rgba(120,80,10,0.14)" />
      <Rect x="4" y="4" width="8" height="6" rx="1" fill="rgba(120,80,10,0.18)" />
      <Rect x="34" y="4" width="8" height="6" rx="1" fill="rgba(120,80,10,0.18)" />
      <Rect x="4" y="24" width="8" height="6" rx="1" fill="rgba(120,80,10,0.18)" />
      <Rect x="34" y="24" width="8" height="6" rx="1" fill="rgba(120,80,10,0.18)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.largeCard,
    overflow: 'hidden',
    shadowColor: '#0E1F45',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  card: {
    borderRadius: radius.largeCard,
    padding: space[20],
    minHeight: 200,
    overflow: 'hidden',
  },
  orbTop: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  orbBottom: {
    position: 'absolute',
    left: -32,
    bottom: -64,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  plan: {
    fontFamily: font.sansSemi,
    fontSize: 13,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.88)',
  },
  eye: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    ...typeScale.display,
    color: color.white,
    letterSpacing: 4,
  },
  soldeLabel: {
    fontFamily: font.sans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.62)',
    marginBottom: 4,
  },
  skelAmount: { height: 38, width: '58%', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 6, marginBottom: 2 },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
    marginTop: space[16],
  },
  flow: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaK: {
    fontFamily: font.sans,
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
  },
  metaV: {
    fontFamily: font.sansSemi,
    fontSize: 13,
    color: color.white,
    marginTop: 2,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  holder: {
    flex: 1,
    fontFamily: font.sansMed,
    fontSize: 12,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.82)',
    marginRight: 12,
  },
});
