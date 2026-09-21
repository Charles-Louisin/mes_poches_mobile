import { Platform, StyleSheet, Text, View } from 'react-native';
import { color, radius, shadow, space, type as font } from '@/theme/tokens';
import { Enter } from './enter';
import { EntityAvatar } from './entity-avatar';
import { PressScale } from './press-scale';

export function Passbook({
  name,
  amount,
  monthIncome,
  monthExpense,
  formatAmount,
  hidden,
  imageUrl,
  onPress,
  index = 0,
}: {
  name: string;
  amount: string;
  monthIncome?: number;
  monthExpense?: number;
  formatAmount?: (n: number) => string;
  hidden?: boolean;
  imageUrl?: string | null;
  onPress?: () => void;
  index?: number;
}) {
  const showMonth = formatAmount && (monthIncome !== undefined || monthExpense !== undefined);
  const income = formatAmount?.(monthIncome ?? 0) ?? '';
  const expense = formatAmount?.(monthExpense ?? 0) ?? '';

  return (
    <Enter delay={40 + index * 60}>
      <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={name} style={styles.wrap}>
        <EntityAvatar imageUrl={imageUrl} name={name} type="wallet" size={48} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {showMonth ? (
            <View style={styles.month}>
              <Text style={styles.in}>{hidden ? '+•••' : `+${income}`}</Text>
              <Text style={styles.out}>{hidden ? '−•••' : `−${expense}`}</Text>
              <Text style={styles.ce}>ce mois</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </Text>
      </PressScale>
    </Enter>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[16],
    marginBottom: 12,
    gap: 12,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 16px rgba(17,17,17,0.05)' } : shadow.soft),
  },
  body: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: font.sansSemi,
    fontSize: 16,
    color: color.text,
  },
  month: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  in: { fontFamily: font.sansMed, fontSize: 11, color: color.success },
  out: { fontFamily: font.sansMed, fontSize: 11, color: color.danger },
  ce: { fontFamily: font.sans, fontSize: 11, color: color.textMuted },
  amount: {
    fontFamily: font.sansBold,
    fontSize: 16,
    color: color.text,
    maxWidth: '38%',
    textAlign: 'right',
  },
});
