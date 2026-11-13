import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { plannedExpenseApi, type PlannedExpense, type Wallet } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, nameOf } from '@/lib/utils';
import { useConfirm } from '@/contexts/confirm';
import { useToast } from '@/contexts/toast';
import { color, radius, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

/** La poche couvre-t-elle déjà le montant ? (poche peuplée, ou solde fourni par l'écran). */
export function isPlannedFundable(item: PlannedExpense, walletBalance?: number): boolean {
  const w = item.wallet_id as Wallet | string;
  const balance = walletBalance ?? (typeof w === 'object' && w ? w.current_balance : undefined);
  return item.status === 'scheduled' && typeof balance === 'number' && balance >= item.amount;
}

export function PlannedItem({
  item,
  formatAmount,
  cancelling,
  walletBalance,
  onEdit,
  onCancel,
  onSettled,
}: {
  item: PlannedExpense;
  formatAmount: (n: number) => string;
  cancelling?: boolean;
  /** Solde de la poche quand `wallet_id` n'est pas peuplé (page d'une poche). */
  walletBalance?: number;
  onEdit?: () => void;
  onCancel: () => void;
  onSettled?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [settling, setSettling] = useState(false);
  const title =
    nameOf(item.category_id as { name: string } | string, '') || item.description || 'Dépense prévue';
  const wallet = nameOf(item.wallet_id as { name: string } | string, '');
  const fundable = isPlannedFundable(item, walletBalance);

  const settle = async () => {
    const ok = await confirm({
      title: 'Régler cette dépense maintenant ?',
      body: `${formatAmount(item.amount)} sera débité${wallet ? ` de ${wallet}` : ''} aujourd’hui, au lieu du ${formatDate(item.scheduled_date)}.`,
      confirmLabel: 'Régler',
    });
    if (!ok) return;
    setSettling(true);
    try {
      await plannedExpenseApi.settle(item._id);
      await invalidateFinance();
      toast('Dépense réglée', 'ok');
      onSettled?.();
    } catch (err) {
      toast(getErrorMessage(err, 'Règlement impossible'), 'err');
    } finally {
      setSettling(false);
    }
  };

  return (
    <View style={[styles.card, fundable && styles.cardReady]}>
      <View style={styles.top}>
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
              <PressScale onPress={onEdit} hitSlop={10} disabled={settling || cancelling}>
                <Text style={styles.link}>Modifier</Text>
              </PressScale>
            ) : null}
            <PressScale onPress={onCancel} hitSlop={10} disabled={cancelling || settling} accessibilityLabel="Annuler l’échéance">
              {cancelling ? <ActivityIndicator size="small" color={color.danger} /> : <Text style={styles.cancel}>Annuler</Text>}
            </PressScale>
          </View>
        </View>
      </View>
      {fundable ? (
        <View style={styles.ready}>
          <CheckCircle2 color={color.success} size={16} strokeWidth={2.2} />
          <Text style={styles.readyT}>La poche couvre le montant.</Text>
          <PressScale
            onPress={() => void settle()}
            disabled={settling}
            style={styles.settle}
            accessibilityRole="button"
            accessibilityLabel="Régler maintenant"
            accessibilityState={{ busy: settling }}>
            {settling ? <ActivityIndicator size="small" color={color.white} /> : <Text style={styles.settleT}>Régler maintenant</Text>}
          </PressScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#BFDBFE',
    backgroundColor: color.primaryVeryLight,
    marginBottom: 10,
    gap: 12,
  },
  cardReady: { borderStyle: 'solid', borderColor: '#A7E9C9', backgroundColor: '#F2FBF6' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: font.sansMed, fontSize: 15, color: color.text },
  when: { fontFamily: font.sansMed, fontSize: 12, color: color.primary, marginTop: 3 },
  wallet: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amt: { fontFamily: font.sansSemi, fontSize: 15, color: color.danger },
  actions: { flexDirection: 'row', gap: 14, marginTop: 8, minHeight: 20, alignItems: 'center' },
  link: { fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  cancel: { fontFamily: font.sansMed, fontSize: 13, color: color.danger },
  ready: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  readyT: { flex: 1, minWidth: 140, fontFamily: font.sansMed, fontSize: 13, color: '#067647' },
  settle: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: color.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleT: { fontFamily: font.sansSemi, fontSize: 13, color: color.white },
});
