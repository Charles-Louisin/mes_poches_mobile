import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react-native';
import type { TransactionLineItem } from '@/lib/api';
import { color, radius, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

function amountPart(item: TransactionLineItem, formatAmount: (n: number) => string) {
  const qty = item.quantity && item.quantity > 1 ? item.quantity : null;
  const unit = item.unit_amount ?? (qty ? item.amount / qty : null);
  if (qty && unit != null) {
    return `${formatAmount(unit)} ×${qty} — ${formatAmount(item.amount)}`;
  }
  return formatAmount(item.amount);
}

export function LineItems({
  items,
  formatAmount,
  editable,
  defaultOpen = false,
  onDescriptionChange,
  onAmountChange,
  onRemove,
}: {
  items?: TransactionLineItem[];
  formatAmount: (n: number) => string;
  editable?: boolean;
  defaultOpen?: boolean;
  onDescriptionChange?: (index: number, description: string) => void;
  onAmountChange?: (index: number, amount: string) => void;
  onRemove?: (index: number) => void;
}) {
  const list = items ?? [];
  const [open, setOpen] = useState(defaultOpen || !!editable);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  if (list.length === 0) return null;

  return (
    <View style={styles.box}>
      <PressScale onPress={() => setOpen((v) => !v)} style={styles.head} accessibilityRole="button">
        {open ? <ChevronDown color={color.primary} size={18} /> : <ChevronRight color={color.textMuted} size={18} />}
        <Text style={styles.headT}>
          {list.length} article{list.length > 1 ? 's' : ''}
          {editable ? ' · modifier' : ''}
        </Text>
      </PressScale>
      {open
        ? list.map((item, idx) => (
            <View key={`${idx}-${item.description}`} style={styles.row}>
              {editable && (onDescriptionChange || onAmountChange) ? (
                <View style={styles.editRow}>
                  <TextInput
                    value={item.description}
                    onChangeText={(t) => onDescriptionChange?.(idx, t)}
                    style={[styles.input, styles.inputLabel]}
                    placeholder="Libellé"
                    placeholderTextColor={color.textMuted}
                    editable={!!onDescriptionChange}
                  />
                  <TextInput
                    value={drafts[idx] ?? String(item.amount ?? '')}
                    onChangeText={(t) => {
                      setDrafts((prev) => ({ ...prev, [idx]: t }));
                      onAmountChange?.(idx, t);
                    }}
                    style={[styles.input, styles.inputAmt]}
                    placeholder="0"
                    placeholderTextColor={color.textMuted}
                    keyboardType="decimal-pad"
                    editable={!!onAmountChange}
                  />
                  {onRemove && list.length > 1 ? (
                    <PressScale
                      onPress={() => {
                        setDrafts({});
                        onRemove(idx);
                      }}
                      style={styles.trash}
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer la ligne">
                      <Trash2 color={color.danger} size={18} />
                    </PressScale>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.read}>
                  {item.description || 'Sans libellé'} — {amountPart(item, formatAmount)}
                </Text>
              )}
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
    marginTop: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headT: { fontFamily: font.sansMed, fontSize: 14, color: color.text, flex: 1 },
  row: { paddingHorizontal: 12, paddingBottom: 12 },
  editRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  read: { flex: 1, fontFamily: font.sans, fontSize: 14, color: color.textSecondary, lineHeight: 20 },
  input: {
    fontFamily: font.sans,
    fontSize: 15,
    color: color.text,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  inputLabel: { flex: 1.4 },
  inputAmt: { width: 96, textAlign: 'right' },
  trash: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FDECEC',
  },
});
