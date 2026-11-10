import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react-native';
import { lineCategoryId, type TransactionLineItem } from '@/lib/api';
import { OptionList } from './option-list';
import { Sheet } from './sheet';
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
  categories,
  parentCategoryName,
  onCategoryChange,
}: {
  items?: TransactionLineItem[];
  formatAmount: (n: number) => string;
  editable?: boolean;
  defaultOpen?: boolean;
  onDescriptionChange?: (index: number, description: string) => void;
  onAmountChange?: (index: number, amount: string) => void;
  onRemove?: (index: number) => void;
  /** Catégories du type de la transaction : active le choix d'une catégorie par ligne. */
  categories?: { _id: string; name: string }[];
  /** Nom de la catégorie de la transaction (ligne sans catégorie propre). */
  parentCategoryName?: string;
  onCategoryChange?: (index: number, categoryId: string | null) => void;
}) {
  const list = items ?? [];
  const [catFor, setCatFor] = useState<number | null>(null);
  const showCats = !!categories && list.length > 1;
  const catLabel = (item: TransactionLineItem) => {
    const id = lineCategoryId(item);
    const populated = item.category_id && typeof item.category_id === 'object' ? item.category_id.name : undefined;
    if (!id) return parentCategoryName ? `Comme la transaction (${parentCategoryName})` : 'Comme la transaction';
    return categories?.find((c) => c._id === id)?.name ?? populated ?? 'Catégorie';
  };
  // Peu de lignes : visibles d'emblée (ex. « Alimentation » → Pain, Riz). Liste longue : repliée.
  const [open, setOpen] = useState(defaultOpen || !!editable || list.length <= 6);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  if (list.length === 0) return null;

  return (
    <View style={styles.box}>
      <PressScale onPress={() => setOpen((v) => !v)} style={styles.head} accessibilityRole="button">
        {open ? <ChevronDown color={color.primary} size={18} /> : <ChevronRight color={color.textMuted} size={18} />}
        <Text style={styles.headT}>
          Détail · {list.length} ligne{list.length > 1 ? 's' : ''}
          {editable ? ' · modifier' : ''}
        </Text>
      </PressScale>
      {open
        ? list.map((item, idx) => (
            // Clé STABLE (position) : inclure le libellé recréait le champ à chaque frappe → le curseur sautait.
            <View key={`line-${idx}`} style={styles.row}>
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
                <View style={styles.readRow}>
                  <Text style={styles.read} numberOfLines={2}>
                    {item.description || 'Sans libellé'}
                  </Text>
                  <Text style={styles.readAmt}>{amountPart(item, formatAmount)}</Text>
                </View>
              )}
              {showCats ? (
                onCategoryChange ? (
                  <PressScale
                    onPress={() => setCatFor(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={`Catégorie de la ligne ${idx + 1} : ${catLabel(item)}`}
                    style={styles.cat}>
                    <Text style={styles.catK}>Catégorie</Text>
                    <Text style={[styles.catV, !lineCategoryId(item) && styles.catInherit]} numberOfLines={1}>
                      {catLabel(item)}
                    </Text>
                    <ChevronDown color={color.primary} size={14} />
                  </PressScale>
                ) : lineCategoryId(item) ? (
                  <Text style={styles.catRead} numberOfLines={1}>
                    {catLabel(item)}
                  </Text>
                ) : null
              ) : null}
            </View>
          ))
        : null}
      {onCategoryChange && categories ? (
        <Sheet open={catFor !== null} onClose={() => setCatFor(null)} title="Catégorie de la ligne">
          <OptionList
            options={[
              { value: '', label: parentCategoryName ? `Comme la transaction (${parentCategoryName})` : 'Comme la transaction' },
              ...categories.map((c) => ({ value: c._id, label: c.name })),
            ]}
            value={catFor !== null ? lineCategoryId(list[catFor] ?? {}) : ''}
            onChange={(v) => {
              if (catFor !== null) onCategoryChange(catFor, v || null);
              setCatFor(null);
            }}
          />
        </Sheet>
      ) : null}
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
  readRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 32 },
  catK: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
  catV: { flexShrink: 1, fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  catInherit: { color: color.textSecondary },
  catRead: { fontFamily: font.sans, fontSize: 12, color: color.primary, marginTop: 2 },
  read: { flex: 1, fontFamily: font.sans, fontSize: 14, color: color.text, lineHeight: 20 },
  readAmt: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary, lineHeight: 20, fontVariant: ['tabular-nums'] },
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
  inputLabel: { flex: 1, minWidth: 0 },
  inputAmt: { width: 96, flexShrink: 0, textAlign: 'right' },
  trash: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FDECEC',
  },
});
