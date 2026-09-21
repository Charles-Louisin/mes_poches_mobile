import { StyleSheet, Text, View } from 'react-native';
import type { PlannedExpense } from '@/lib/api';
import { formatDate, nameOf } from '@/lib/utils';
import { color, radius, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function PlannedItem({
  item,
  formatAmount,
  cancelling,
  onEdit,
  onCancel,
}: {
  item: PlannedExpense;
  formatAmount: (n: number) => string;
  cancelling?: boolean;
  onEdit?: () => void;
  onCancel: () => void;
}) {
  const title =
    nameOf(item.category_id as { name: string } | string, '') || item.description || 'Dépense prévue';
  const wallet = nameOf(item.wallet_id as { name: string } | string, '');

  return (
    <View style={styles.card}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.when}>Prévu le {formatDate(item.scheduled_date)}</Text>
        {wallet ? <Text style={styles.wallet}>{wallet}</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amt}>−{formatAmount(item.amount)}</Text>
        <View style={styles.actions}>
          {onEdit ? (
            <PressScale onPress={onEdit} hitSlop={8}>
              <Text style={styles.link}>Modifier</Text>
            </PressScale>
          ) : null}
          <PressScale onPress={onCancel} hitSlop={8} disabled={cancelling}>
            <Text style={styles.cancel}>{cancelling ? '…' : 'Annuler'}</Text>
          </PressScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#BFDBFE',
    backgroundColor: color.primaryVeryLight,
    marginBottom: 10,
  },
  title: { fontFamily: font.sansMed, fontSize: 15, color: color.text },
  when: { fontFamily: font.sansMed, fontSize: 12, color: color.primary, marginTop: 3 },
  wallet: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amt: { fontFamily: font.sansSemi, fontSize: 15, color: color.danger },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  link: { fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  cancel: { fontFamily: font.sansMed, fontSize: 13, color: color.danger },
});
