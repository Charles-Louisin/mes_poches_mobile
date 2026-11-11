import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowUpDown, ChevronDown } from 'lucide-react-native';
import { OptionList } from '@/components/ui/option-list';
import { PressScale } from '@/components/ui/press-scale';
import { Sheet } from '@/components/ui/sheet';
import { color, radius, type as font } from '@/theme/tokens';

export type SortKey =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'amount-desc'
  | 'amount-asc'
  | 'date-desc'
  | 'date-asc'
  | 'category'
  | 'wallet';

/** Tranches de montant (filtre) : bornes en devise de l'utilisateur. */
export type RangeKey = 'all' | 'lt10' | '10to50' | '50to200' | 'gt200';

const SORT_LABEL: Record<SortKey, string> = {
  default: 'Ordre par défaut',
  'name-asc': 'Nom de A à Z',
  'name-desc': 'Nom de Z à A',
  'amount-desc': 'Montant décroissant',
  'amount-asc': 'Montant croissant',
  'date-desc': 'Date, plus récent d’abord',
  'date-asc': 'Date, plus ancien d’abord',
  category: 'Catégorie',
  wallet: 'Poche',
};

/** Libellé court affiché dans le bouton. */
const SORT_SHORT: Record<SortKey, string> = {
  default: 'Trier',
  'name-asc': 'A → Z',
  'name-desc': 'Z → A',
  'amount-desc': 'Montant ↓',
  'amount-asc': 'Montant ↑',
  'date-desc': 'Récent',
  'date-asc': 'Ancien',
  category: 'Catégorie',
  wallet: 'Poche',
};

const RANGES: { key: RangeKey; label: string; min: number; max: number }[] = [
  { key: 'all', label: 'Toutes', min: -Infinity, max: Infinity },
  { key: 'lt10', label: '< 10 000', min: -Infinity, max: 10_000 },
  { key: '10to50', label: '10 000 – 50 000', min: 10_000, max: 50_000 },
  { key: '50to200', label: '50 000 – 200 000', min: 50_000, max: 200_000 },
  { key: 'gt200', label: '> 200 000', min: 200_000, max: Infinity },
];

export type SortAccessors<T> = {
  name: (item: T) => string;
  amount: (item: T) => number;
  date?: (item: T) => string | null | undefined;
  category?: (item: T) => string | null | undefined;
  wallet?: (item: T) => string | null | undefined;
};

const collator = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' });

/**
 * Tri et tranche de montant d'une section d'analyse. Les options proposées dépendent
 * des champs disponibles (date, catégorie, poche).
 */
export function useSectionSort<T>(items: T[], get: SortAccessors<T>, defaultLabel = 'Ordre par défaut') {
  const [sort, setSort] = useState<SortKey>('default');
  const [range, setRange] = useState<RangeKey>('all');
  const [open, setOpen] = useState(false);

  const keys = useMemo(() => {
    const list: SortKey[] = ['default', 'name-asc', 'name-desc', 'amount-desc', 'amount-asc'];
    if (get.date) list.push('date-desc', 'date-asc');
    if (get.category) list.push('category');
    if (get.wallet) list.push('wallet');
    return list;
  }, [get.date, get.category, get.wallet]);

  const sorted = useMemo(() => {
    const bounds = RANGES.find((r) => r.key === range) ?? RANGES[0];
    const filtered = items.filter((item) => {
      const v = Math.abs(get.amount(item));
      return v >= bounds.min && v < bounds.max;
    });
    if (sort === 'default') return filtered;
    const time = (item: T) => {
      const raw = get.date?.(item);
      const t = raw ? new Date(raw).getTime() : NaN;
      return Number.isNaN(t) ? 0 : t;
    };
    const list = [...filtered];
    list.sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return collator(get.name(a), get.name(b));
        case 'name-desc':
          return collator(get.name(b), get.name(a));
        case 'amount-desc':
          return get.amount(b) - get.amount(a);
        case 'amount-asc':
          return get.amount(a) - get.amount(b);
        case 'date-desc':
          return time(b) - time(a);
        case 'date-asc':
          return time(a) - time(b);
        case 'category':
          return collator(get.category?.(a) || '~', get.category?.(b) || '~') || get.amount(b) - get.amount(a);
        case 'wallet':
          return collator(get.wallet?.(a) || '~', get.wallet?.(b) || '~') || get.amount(b) - get.amount(a);
        default:
          return 0;
      }
    });
    return list;
  }, [items, sort, range, get]);

  const active = sort !== 'default' || range !== 'all';

  return {
    items: sorted,
    hiddenByRange: items.length - sorted.length,
    button: (
      <PressScale
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Trier : ${SORT_LABEL[sort]}`}
        style={[styles.btn, active && styles.btnActive]}>
        <ArrowUpDown color={active ? color.primary : color.textSecondary} size={14} strokeWidth={2.2} />
        <Text style={[styles.btnLabel, active && styles.btnLabelActive]}>
          {SORT_SHORT[sort]}
          {range !== 'all' ? ' · tranche' : ''}
        </Text>
        <ChevronDown color={active ? color.primary : color.textSecondary} size={14} strokeWidth={2.2} />
      </PressScale>
    ),
    sheet: (
      <Sheet open={open} onClose={() => setOpen(false)} title="Trier">
        <OptionList
          value={sort}
          onChange={(value) => {
            setSort(value as SortKey);
            setOpen(false);
          }}
          options={keys.map((key) => ({ value: key, label: key === 'default' ? defaultLabel : SORT_LABEL[key] }))}
        />
        <Text style={styles.rangeTitle}>Tranche de montant</Text>
        <View style={styles.chips}>
          {RANGES.map((r) => {
            const on = r.key === range;
            return (
              <PressScale
                key={r.key}
                onPress={() => setRange(r.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{r.label}</Text>
              </PressScale>
            );
          })}
        </View>
        {active ? (
          <PressScale
            onPress={() => {
              setSort('default');
              setRange('all');
              setOpen(false);
            }}
            accessibilityRole="button"
            style={styles.reset}>
            <Text style={styles.resetLabel}>Réinitialiser</Text>
          </PressScale>
        ) : null}
      </Sheet>
    ),
  };
}

/** Titre de section avec le bouton « Trier » à droite. */
export function SectionHead({ title, icon, button }: { title: string; icon?: React.ReactNode; button: React.ReactNode }) {
  return (
    <View style={styles.head}>
      <View style={styles.headLeft}>
        {icon}
        <Text style={styles.headTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {button}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  headTitle: { fontFamily: font.sansSemi, fontSize: 17, color: color.text, flexShrink: 1 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.white,
  },
  btnActive: { borderColor: color.primary, backgroundColor: color.primaryLight },
  btnLabel: { fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary },
  btnLabelActive: { color: color.primary },
  rangeTitle: { fontFamily: font.sansSemi, fontSize: 14, color: color.text, marginTop: 18, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipOn: { borderColor: color.primary, backgroundColor: color.primaryLight },
  chipLabel: { fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary, fontVariant: ['tabular-nums'] },
  chipLabelOn: { color: color.primary },
  reset: { alignSelf: 'center', marginTop: 18, paddingVertical: 10, paddingHorizontal: 16 },
  resetLabel: { fontFamily: font.sansSemi, fontSize: 14, color: color.primary },
});
