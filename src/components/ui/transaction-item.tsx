import { StyleSheet, Text, View } from 'react-native';
import { formatRelativeDate, getTransactionTypeLabel, nameOf, savingsGoalIdOf } from '@/lib/utils';
import { iconForCategory, toneForType } from '@/lib/tx-icons';
import type { Category, Transaction } from '@/lib/api';
import { color, type as font, space } from '@/theme/tokens';
import { EntityAvatar } from './entity-avatar';
import { IconCircle, iconToneColor } from './icon-circle';
import { PressScale } from './press-scale';
import { TxExportRow } from './tx-export-row';

export function TransactionItem({
  tx,
  formatAmount,
  onPress,
  exportRow,
}: {
  tx: Transaction;
  formatAmount: (n: number) => string;
  onPress?: () => void;
  exportRow?: boolean;
}) {
  const cat = tx.category_id && typeof tx.category_id === 'object' ? (tx.category_id as Category) : null;
  const savingsId = savingsGoalIdOf(tx.savings_goal_id);
  const savingsTitle =
    tx.savings_goal_id && typeof tx.savings_goal_id === 'object' ? tx.savings_goal_id.title : null;
  const typeLabel = getTransactionTypeLabel(tx.type, savingsId);
  const categoryName = savingsTitle ?? cat?.name ?? tx.description ?? typeLabel;
  const wallet = nameOf(tx.wallet_id as { name: string } | string, '—');
  const lines = tx.line_items?.length ?? 0;
  // Lignes d'une même catégorie (ex. Alimentation : Pain, Riz) affichées sous la transaction.
  const lineNames = lines > 1
    ? (() => {
        const names = [...new Set((tx.line_items ?? []).map((l) => l.description?.trim()).filter(Boolean))] as string[];
        return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
      })()
    : '';
  const Icon = iconForCategory(categoryName, tx.type);
  const tone = savingsId ? 'warning' : toneForType(tx.type);
  const sign = savingsId
    ? tx.type === 'income'
      ? '+'
      : '−'
    : tx.type === 'expense'
      ? '−'
      : tx.type === 'income'
        ? '+'
        : '';
  const amountColor = savingsId
    ? '#B45309'
    : tx.type === 'income'
      ? color.success
      : tx.type === 'expense'
        ? color.danger
        : color.text;

  return (
    <View>
      <PressScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel} ${categoryName}, ${sign}${formatAmount(tx.amount)}`}
        style={styles.row}>
        {cat?.image_url ? (
          <EntityAvatar imageUrl={cat.image_url} name={cat.name} type="category" size={44} />
        ) : (
          <IconCircle tone={tone} size={44}>
            <Icon color={iconToneColor(tone)} size={20} strokeWidth={2} />
          </IconCircle>
        )}
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {typeLabel} {'>'} {categoryName}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {formatRelativeDate(tx.date)} {'>'} {wallet}
          </Text>
          {lineNames ? (
            <Text style={styles.lines} numberOfLines={1}>
              {lineNames}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.amount, { color: amountColor }]}>
          {sign}
          {formatAmount(tx.amount)}
        </Text>
      </PressScale>
      {exportRow ? <TxExportRow transactionId={tx._id} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingVertical: 12,
    minHeight: 64,
  },
  meta: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: font.sansMed,
    fontSize: 16,
    color: color.text,
  },
  sub: {
    fontFamily: font.sans,
    fontSize: 12,
    color: color.textMuted,
    marginTop: 2,
  },
  /** Lignes de la transaction (ex. Pain, Riz) sous le libellé. */
  lines: {
    fontFamily: font.sans,
    fontSize: 12,
    color: color.textSecondary,
    marginTop: 2,
  },
  amount: {
    fontFamily: font.sansSemi,
    fontSize: 15,
  },
});
