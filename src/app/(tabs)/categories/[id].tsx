import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Download, Info, Pencil, Search, Trash2, X } from 'lucide-react-native';
import {
  analyticsApi,
  categoryApi,
  lineCategoryId,
  transactionApi,
  walletApi,
  type ExportFormat,
  type Transaction,
} from '@/lib/api';
import { buildMonthOptions, filterTransactions, getCategoryId, type TransactionFiltersState } from '@/lib/filterTransactions';
import { defaultOpenDayKey, groupTransactionsByDate } from '@/lib/utils';
import { walletOption } from '@/lib/plan-options';
import { invalidateFinance } from '@/lib/query';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { exportSavedToast, shareExport } from '@/lib/download';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { CategoryForm } from '@/components/category-form';
import { quotaPromptFromError, showQuotaPrompt } from '@/components/subscription/quota-prompt';
import { Chip } from '@/components/ui/chip';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { InfoSheet } from '@/components/ui/info-sheet';
import { OptionList } from '@/components/ui/option-list';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { TransactionItem } from '@/components/ui/transaction-item';
import { CsvIcon, ExcelIcon, PdfIcon } from '@/components/ui/export-icons';
import { color, radius, shadow, type as font } from '@/theme/tokens';

const emptyFilters: TransactionFiltersState = { q: '', type: '', walletId: '', categoryId: '', monthYm: '' };

/** Montant d'une opération qui revient à cette catégorie (articles d'un ticket classés ailleurs exclus). */
function partFor(t: Transaction, id: string): number {
  const lines = t.line_items ?? [];
  if (lines.some((l) => lineCategoryId(l))) {
    return lines
      .filter((l) => (lineCategoryId(l) || getCategoryId(t)) === id)
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }
  return getCategoryId(t) === id ? t.amount : 0;
}

const SHARE_INFO = {
  title: 'Calcul du pourcentage',
  howTitle: 'À savoir',
  what: 'Dans Analyse, le pourcentage d’une catégorie = son total du mois ÷ le total des sorties du mois (ou des entrées, pour une catégorie d’entrée).',
  how: [
    'Exemple : 30 000 en Transport sur 120 000 de sorties en mars → 25 %.',
    'Une opération avec plusieurs articles compte article par article : chaque article va dans sa propre catégorie, ou dans celle de l’opération s’il n’en a pas.',
    'Les sorties sans catégorie comptent dans le total : la somme des pourcentages peut donc rester sous 100 %.',
    'Les virements entre poches et les versements d’épargne ne sont pas des sorties : ils ne comptent pas.',
  ],
};

export default function CategoryDetailScreen() {
  const { id, month } = useLocalSearchParams<{ id: string; month?: string }>();
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [filters, setFilters] = useState<TransactionFiltersState>({ ...emptyFilters, monthYm: month ?? '' });
  const [pick, setPick] = useState<'wallet' | 'month' | 'export' | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [openReady, setOpenReady] = useState(false);

  const cat = useQuery({ queryKey: ['category', id], enabled: !!id, queryFn: () => categoryApi.getById(id) });
  const txs = useQuery({
    queryKey: ['category-transactions', id],
    enabled: !!id,
    queryFn: () => transactionApi.getAll({ category_id: id, limit: 200 }),
  });
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: () => walletApi.getAll() });
  const category = cat.data;

  const list = useMemo(() => filterTransactions(txs.data ?? [], filters), [txs.data, filters]);
  const total = useMemo(() => list.reduce((s, t) => s + partFor(t, id), 0), [list, id]);
  const months = useMemo(() => buildMonthOptions(txs.data ?? []), [txs.data]);
  const groups = groupTransactionsByDate(list);

  // Part de la catégorie dans le mois filtré : même calcul que la page Analyse.
  const [y, m] = (filters.monthYm || '').split('-').map(Number);
  const monthStats = useQuery({
    queryKey: ['analytics-month', y, m],
    enabled: !!filters.monthYm && !!y && !!m,
    queryFn: () => analyticsApi.getMonth(y, m).catch(() => null),
  });
  const monthTotal = category?.type === 'income' ? monthStats.data?.totalIncome : monthStats.data?.totalExpense;
  const share = filters.monthYm && monthTotal ? (total / monthTotal) * 100 : null;

  useEffect(() => setOpenReady(false), [filters]);
  useEffect(() => {
    if (groups.length && !openReady) {
      const key = defaultOpenDayKey(groups.map((g) => g.dayKey));
      setOpenDays(key ? new Set([key]) : new Set());
      setOpenReady(true);
    }
  }, [groups, openReady]);

  const save = async (draft: { name: string; type: 'expense' | 'income'; image_url: string | null }) => {
    setSaving(true);
    try {
      await categoryApi.update(id, draft);
      await invalidateFinance();
      await cat.refetch();
      setEditing(false);
      toast('Catégorie modifiée', 'ok');
    } catch (err) {
      if (quotaPromptFromError(err)) return;
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
      } else toast(getErrorMessage(err, 'Modification impossible'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!category) return;
    const ok = await confirm({
      title: 'Supprimer cette catégorie ?',
      body: `« ${category.name} » est supprimée. Les opérations déjà classées restent dans l’historique, sans catégorie.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await categoryApi.delete(id);
      await invalidateFinance();
      toast('Catégorie supprimée', 'ok');
      router.back();
    } catch (err) {
      toast(getErrorMessage(err, 'Suppression impossible'), 'err');
    } finally {
      setRemoving(false);
    }
  };

  const formats = (user?.exportFormats?.length ? user.exportFormats : ['pdf', 'xlsx', 'csv']) as ExportFormat[];
  const startExport = () => {
    if (!user?.canExportRange) {
      showQuotaPrompt({
        message: 'L’export par catégorie est inclus dans le forfait Business.',
        nextTier: 'business',
        nextLabel: 'Business',
        nextPriceXaf: null,
      });
      return;
    }
    setPick('export');
  };
  const runExport = async (format: ExportFormat) => {
    if (!category || exporting) return;
    setExporting(format);
    try {
      const slug = category.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const dest = await shareExport(`/export/transactions?format=${format}&categories=${id}`, `mes-poches-${slug || 'categorie'}.${format}`);
      const saved = exportSavedToast(dest);
      toast(saved.message, saved.tone);
      setPick(null);
    } catch (err) {
      if (quotaPromptFromError(err)) setPick(null);
      else toast(getErrorMessage(err, 'Export impossible'), 'err');
    } finally {
      setExporting(null);
    }
  };

  if (!category) {
    return (
      <Screen>
        <ScreenHeader title="Catégorie" back />
        {cat.isLoading ? <PageSkeleton variant="cards" rows={2} /> : <Text style={styles.muted}>Catégorie introuvable.</Text>}
      </Screen>
    );
  }

  const hasFilters = !!(filters.q || filters.walletId || filters.monthYm);
  const periodLabel = months.find((mo) => mo.value === filters.monthYm)?.label;

  return (
    <Screen scroll keyboardAware onRefresh={() => void Promise.all([cat.refetch(), txs.refetch()])} refreshing={txs.isRefetching}>
      <ScreenHeader title={editing ? 'Modifier la catégorie' : category.name} back />

      {editing ? (
        <View style={{ marginBottom: 28 }}>
          <CategoryForm
            initial={{ name: category.name, type: category.type, image_url: category.image_url ?? null }}
            submitLabel="Enregistrer"
            loading={saving}
            onSubmit={(d) => void save(d)}
            onCancel={() => setEditing(false)}
          />
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <EntityAvatar imageUrl={category.image_url} name={category.name} type="category" size={52} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.kind, category.type === 'income' ? styles.kindIn : styles.kindOut]}>
                  {category.type === 'income' ? 'Entrée' : 'Sortie'}
                </Text>
                <Text style={styles.heroK}>{periodLabel ? `Total · ${periodLabel}` : 'Total de l’historique'}</Text>
              </View>
            </View>
            <Text style={[styles.heroAmt, { color: category.type === 'income' ? color.success : color.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(total)}
            </Text>
            <View style={styles.heroFoot}>
              <Text style={styles.heroMeta}>
                {list.length} opération{list.length > 1 ? 's' : ''}
                {share != null ? ` · ${share.toFixed(share < 10 ? 1 : 0)} % des ${category.type === 'income' ? 'entrées' : 'sorties'} du mois` : ''}
              </Text>
              <PressScale onPress={() => setInfoOpen(true)} hitSlop={10} style={styles.infoBtn} accessibilityRole="button" accessibilityLabel="Comment le pourcentage est calculé">
                <Info color={color.primary} size={15} strokeWidth={2.2} />
                <Text style={styles.infoT}>Calcul du %</Text>
              </PressScale>
            </View>
          </View>

          <View style={styles.actions}>
            <PressScale onPress={() => setEditing(true)} style={styles.action} accessibilityRole="button">
              <Pencil color={color.primary} size={18} />
              <Text style={styles.actionT}>Modifier</Text>
            </PressScale>
            <PressScale onPress={startExport} style={styles.action} accessibilityRole="button" accessibilityLabel="Exporter cette catégorie">
              <Download color={color.primary} size={18} />
              <Text style={styles.actionT}>Exporter</Text>
              {!user?.canExportRange ? <GoldDiamond size={12} /> : null}
            </PressScale>
            <PressScale
              onPress={() => void remove()}
              disabled={removing}
              style={[styles.action, styles.actionDanger]}
              accessibilityRole="button"
              accessibilityState={{ busy: removing }}>
              {removing ? <ActivityIndicator size="small" color={color.danger} /> : <Trash2 color={color.danger} size={18} />}
              <Text style={[styles.actionT, { color: color.danger }]}>Supprimer</Text>
            </PressScale>
          </View>
        </>
      )}

      <Text style={styles.sec}>Historique</Text>
      <View style={styles.searchWrap}>
        <Search color={color.textMuted} size={18} strokeWidth={2} />
        <TextInput
          value={filters.q}
          onChangeText={(q) => setFilters((f) => ({ ...f, q }))}
          placeholder="Rechercher un libellé, une poche…"
          placeholderTextColor={color.textMuted}
          style={styles.search}
        />
        {filters.q ? (
          <PressScale onPress={() => setFilters((f) => ({ ...f, q: '' }))} hitSlop={10} accessibilityLabel="Effacer la recherche">
            <X color={color.textMuted} size={18} strokeWidth={2.2} />
          </PressScale>
        ) : null}
      </View>
      <View style={styles.chips}>
        <Chip
          label={wallets.data?.find((w) => w._id === filters.walletId)?.name || 'Poche'}
          active={!!filters.walletId}
          affordance
          onPress={() => setPick('wallet')}
        />
        <Chip label={periodLabel || 'Mois'} active={!!filters.monthYm} affordance onPress={() => setPick('month')} />
        {hasFilters ? <Chip label="Tout effacer" onPress={() => setFilters(emptyFilters)} /> : null}
      </View>

      {txs.isLoading && !txs.data ? <PageSkeleton variant="list" rows={5} /> : null}
      {groups.map((g) => {
        const isOpen = openDays.has(g.dayKey);
        return (
          <View key={g.dayKey} style={styles.dayCard}>
            <PressScale
              onPress={() =>
                setOpenDays((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.dayKey)) next.delete(g.dayKey);
                  else next.add(g.dayKey);
                  return next;
                })
              }
              style={styles.dayBtn}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}>
              {isOpen ? <ChevronUp color={color.primary} size={20} /> : <ChevronDown color={color.textMuted} size={20} />}
              <Text style={styles.day}>{g.label}</Text>
              <Text style={styles.dayTotal}>{formatAmount(g.items.reduce((s, t) => s + partFor(t, id), 0))}</Text>
            </PressScale>
            {isOpen
              ? g.items.map((t) => {
                  const part = partFor(t, id);
                  return (
                    <View key={t._id}>
                      <TransactionItem tx={t} formatAmount={formatAmount} onPress={() => router.push(`/transactions/${t._id}`)} />
                      {part > 0 && part < t.amount ? (
                        <Text style={styles.part}>Dont {formatAmount(part)} dans cette catégorie</Text>
                      ) : null}
                    </View>
                  );
                })
              : null}
          </View>
        );
      })}
      {txs.isSuccess && list.length === 0 ? (
        <Text style={styles.empty}>{hasFilters ? 'Aucune opération pour ces filtres.' : 'Aucune opération dans cette catégorie pour l’instant.'}</Text>
      ) : null}

      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} info={SHARE_INFO} />
      <Sheet open={pick !== null} onClose={() => setPick(null)} title={pick === 'export' ? `Exporter « ${category.name} »` : 'Filtrer'}>
        {pick === 'wallet' ? (
          <OptionList
            options={[{ value: '', label: 'Toutes les poches' }, ...(wallets.data ?? []).map(walletOption)]}
            value={filters.walletId}
            onChange={(v) => {
              setFilters((f) => ({ ...f, walletId: v }));
              setPick(null);
            }}
          />
        ) : null}
        {pick === 'month' ? (
          <OptionList
            options={[{ value: '', label: 'Tous les mois' }, ...months]}
            value={filters.monthYm}
            onChange={(v) => {
              setFilters((f) => ({ ...f, monthYm: v }));
              setPick(null);
            }}
          />
        ) : null}
        {pick === 'export' ? (
          <OptionList
            options={formats.map((f) => ({
              value: f,
              label: exporting === f ? 'Préparation…' : f === 'xlsx' ? 'Excel (XLSX)' : f.toUpperCase(),
              icon: f === 'pdf' ? <PdfIcon size={20} /> : f === 'xlsx' ? <ExcelIcon size={20} /> : <CsvIcon size={20} />,
              disabled: !!exporting,
            }))}
            onChange={(v) => void runExport(v as ExportFormat)}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: font.sans, color: color.textMuted },
  hero: {
    backgroundColor: color.surface,
    borderRadius: radius.largeCard,
    padding: 20,
    marginBottom: 14,
    ...shadow.soft,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kind: { fontFamily: font.sansSemi, fontSize: 13 },
  kindOut: { color: color.danger },
  kindIn: { color: color.success },
  heroK: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 2 },
  heroAmt: { fontFamily: font.sansBold, fontSize: 32, marginTop: 16, fontVariant: ['tabular-nums'] },
  heroFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  heroMeta: { flexShrink: 1, fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary },
  infoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  infoT: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: color.primaryLight,
  },
  actionDanger: { backgroundColor: '#FEF3F2' },
  actionT: { fontFamily: font.sansSemi, fontSize: 14, color: color.primary },
  sec: { fontFamily: font.sansBold, fontSize: 20, color: color.text, marginTop: 24, marginBottom: 14 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: 12,
  },
  search: { flex: 1, fontFamily: font.sans, fontSize: 16, color: color.text, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  dayCard: { backgroundColor: color.surface, borderRadius: radius.card, paddingHorizontal: 16, paddingBottom: 8, marginBottom: 12 },
  dayBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  day: { fontFamily: font.sansSemi, fontSize: 14, color: color.text, flex: 1 },
  dayTotal: { fontFamily: font.sansSemi, fontSize: 13, color: color.textSecondary },
  part: { fontFamily: font.sansMed, fontSize: 12, color: color.primary, marginTop: -4, marginBottom: 8, marginLeft: 56 },
  empty: { fontFamily: font.sans, fontSize: 14, color: color.textMuted, textAlign: 'center', marginTop: 12 },
});
