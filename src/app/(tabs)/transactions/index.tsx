import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, Info, Search, X } from 'lucide-react-native';
import { categoryApi, plannedExpenseApi, transactionApi, walletApi } from '@/lib/api';
import { buildMonthOptions, filterTransactions, type TransactionFiltersState } from '@/lib/filterTransactions';
import { PLAN_LIMITS } from '@/lib/planLimits';
import { getErrorMessage } from '@/lib/errors';
import { invalidateFinance } from '@/lib/query';
import { defaultOpenDayKey, groupTransactionsByDate, idOf } from '@/lib/utils';
import { categoryOption, walletOption } from '@/lib/plan-options';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { promptLocked } from '@/components/subscription/plan-usage';
import { showQuotaPrompt } from '@/components/subscription/quota-prompt';
import type { Transaction } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EditPlannedSheet } from '@/components/ui/edit-planned-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Enter } from '@/components/ui/enter';
import { OptionList } from '@/components/ui/option-list';
import { PlannedHelpSheet } from '@/components/ui/planned-help-sheet';
import { PlannedItem } from '@/components/ui/planned-item';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { TransactionItem } from '@/components/ui/transaction-item';
import { ReceiptArt } from '@/components/illustrations';
import { color, radius, type as font, typeScale } from '@/theme/tokens';
import type { PlannedExpense } from '@/lib/api';

const emptyFilters: TransactionFiltersState = { q: '', type: '', walletId: '', categoryId: '', monthYm: '' };

export default function JournalScreen() {
  const { isPremium, user } = useAuth();
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const [filters, setFilters] = useState<TransactionFiltersState>(emptyFilters);
  const [pick, setPick] = useState<'wallet' | 'cat' | 'month' | null>(null);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [openReady, setOpenReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hideHelp, setHideHelp] = useState(!!user?.hidePlannedExpensesHelp);
  const [editing, setEditing] = useState<PlannedExpense | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const txs = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionApi.getAll({ limit: 200 }).catch(() => []),
  });
  const planned = useQuery({
    queryKey: ['planned'],
    queryFn: () => plannedExpenseApi.getAll({ status: 'scheduled' }),
  });
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: () => walletApi.getAll() });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.getAll() });
  // Plan gratuit : les opérations plus anciennes existent toujours, on les annonce grisées.
  const historyLock = useQuery({
    queryKey: ['history-lock', isPremium],
    queryFn: () => transactionApi.historyLock(),
    enabled: !isPremium,
  });
  // Poches et catégories hors forfait : leurs opérations restent visibles, grisées avec le diamant.
  const lockedWallets = useMemo(
    () => new Set((wallets.data ?? []).filter((w) => w.locked).map((w) => w._id)),
    [wallets.data]
  );
  const lockedCats = useMemo(
    () => new Set((categories.data ?? []).filter((c) => c.locked).map((c) => c._id)),
    [categories.data]
  );
  const lockOf = (t: Transaction): 'wallets' | 'categories' | null => {
    const w = idOf(t.wallet_id);
    const d = idOf(t.destination_wallet_id);
    if ((w && lockedWallets.has(w)) || (d && lockedWallets.has(d))) return 'wallets';
    const c = idOf(t.category_id);
    return c && lockedCats.has(c) ? 'categories' : null;
  };
  const hiddenOld = historyLock.data?.limited ? historyLock.data.hiddenCount : 0;

  const filtered = useMemo(
    () => filterTransactions(txs.data ?? [], filters),
    [filters, txs.data]
  );
  const groups = groupTransactionsByDate(filtered);
  const months = useMemo(() => buildMonthOptions(txs.data ?? []), [txs.data]);
  const loading = txs.isLoading && !txs.data;
  const hasData = (txs.data ?? []).length > 0;
  const noMatch = hasData && filtered.length === 0;

  useEffect(() => {
    setOpenReady(false);
  }, [filters.q, filters.type, filters.walletId, filters.categoryId, filters.monthYm]);

  useEffect(() => {
    if (groups.length && !openReady) {
      const key = defaultOpenDayKey(groups.map((g) => g.dayKey));
      setOpenDays(key ? new Set([key]) : new Set());
      setOpenReady(true);
    }
  }, [groups, openReady]);

  const toggleDay = (dayKey: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  const cancelPlan = async (id: string) => {
    const ok = await confirm({
      title: 'Annuler cette échéance ?',
      confirmLabel: 'Annuler l’échéance',
      cancelLabel: 'Garder',
      danger: true,
    });
    if (!ok) return;
    try {
      setCancellingId(id);
      await plannedExpenseApi.cancel(id);
      await invalidateFinance();
      toast('Échéance retirée', 'ok');
    } catch (err) {
      toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setCancellingId(null);
    }
  };

  const types = [
    { value: '', label: 'Tout' },
    { value: 'expense', label: 'Dépenses' },
    { value: 'income', label: 'Revenus' },
    { value: 'transfer', label: 'Virements' },
  ] as const;

  return (
    <Screen scroll onRefresh={() => void Promise.all([txs.refetch(), planned.refetch()])} refreshing={txs.isRefetching}>
      <Text style={styles.title}>Historique</Text>
      {hasData ? (
        <>
          <View style={styles.searchWrap}>
            <Search color={color.textMuted} size={18} strokeWidth={2} />
            <TextInput
              value={filters.q}
              onChangeText={(q) => setFilters((f) => ({ ...f, q }))}
              placeholder="Rechercher libellé, catégorie, poche…"
              placeholderTextColor={color.textMuted}
              style={styles.search}
            />
            {filters.q ? (
              <PressScale
                onPress={() => setFilters((f) => ({ ...f, q: '' }))}
                accessibilityLabel="Effacer la recherche"
                hitSlop={8}>
                <X color={color.textMuted} size={18} strokeWidth={2.2} />
              </PressScale>
            ) : null}
          </View>
          <View style={styles.chips}>
            {types.map((t) => (
              <Chip
                key={t.value || 'all'}
                label={t.label}
                active={filters.type === t.value}
                onPress={() => setFilters((f) => ({ ...f, type: t.value }))}
              />
            ))}
          </View>
          <View style={styles.chips}>
            <Chip
              label={wallets.data?.find((w) => w._id === filters.walletId)?.name || 'Poche'}
              active={!!filters.walletId}
              affordance
              onPress={() => setPick('wallet')}
            />
            <Chip
              label={categories.data?.find((c) => c._id === filters.categoryId)?.name || 'Catégorie'}
              active={!!filters.categoryId}
              affordance
              onPress={() => setPick('cat')}
            />
            <Chip
              label={months.find((m) => m.value === filters.monthYm)?.label || 'Mois'}
              active={!!filters.monthYm}
              affordance
              onPress={() => setPick('month')}
            />
          </View>
          {filters.q || filters.type || filters.walletId || filters.categoryId || filters.monthYm ? (
            <PressScale onPress={() => setFilters(emptyFilters)} style={{ marginBottom: 12 }}>
              <Text style={styles.reset}>Réinitialiser les filtres</Text>
            </PressScale>
          ) : null}
        </>
      ) : null}
      {!isPremium ? (
        <Text style={styles.limit}>Historique gratuit : {PLAN_LIMITS.FREE_HISTORY_MONTHS} derniers mois.</Text>
      ) : null}

      {(planned.data ?? []).length > 0 || !hideHelp ? (
        <View style={{ marginBottom: 20 }}>
          <View style={styles.planHead}>
            <Text style={styles.section}>À venir</Text>
            {!hideHelp ? (
              <PressScale onPress={() => setHelpOpen(true)} hitSlop={8} accessibilityLabel="Aide dépenses prévues">
                <Info color={color.primary} size={18} />
              </PressScale>
            ) : null}
          </View>
          {(planned.data ?? []).map((p) => (
            <PlannedItem
              key={p._id}
              item={p}
              formatAmount={formatAmount}
              cancelling={cancellingId === p._id}
              onEdit={() => setEditing(p)}
              onCancel={() => void cancelPlan(p._id)}
            />
          ))}
        </View>
      ) : null}

      {groups.map((g, gi) => {
        const isOpen = openDays.has(g.dayKey);
        return (
          <Enter key={g.dayKey} delay={30 + gi * 40}>
            <View style={styles.dayCard}>
              <PressScale onPress={() => toggleDay(g.dayKey)} style={styles.dayBtn} accessibilityRole="button">
                {isOpen ? <ChevronUp color={color.primary} size={20} /> : <ChevronDown color={color.textMuted} size={20} />}
                <Text style={styles.day}>{g.label}</Text>
                <View style={styles.count}>
                  <Text style={styles.countT}>{g.items.length}</Text>
                </View>
              </PressScale>
              {isOpen
                ? g.items.map((t) => {
                    const lock = lockOf(t);
                    return (
                      <TransactionItem
                        key={t._id}
                        tx={t}
                        formatAmount={formatAmount}
                        exportRow
                        locked={!!lock}
                        onPress={() =>
                          lock ? promptLocked(lock, user?.quotas?.[lock]) : router.push(`/transactions/${t._id}`)
                        }
                      />
                    );
                  })
                : null}
            </View>
          </Enter>
        );
      })}
      {hiddenOld > 0 && !loading ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`${hiddenOld} opérations plus anciennes, disponibles avec le palier Pro`}
          onPress={() =>
            showQuotaPrompt({
              message: `Le plan gratuit affiche les ${PLAN_LIMITS.FREE_HISTORY_MONTHS} derniers mois. Vos ${hiddenOld} opérations plus anciennes sont conservées : passez au palier Pro pour les revoir.`,
              nextTier: "pro",
              nextLabel: "Pro",
              nextPriceXaf: user?.quotas?.wallets?.nextPriceXaf ?? null,
            })
          }
          style={styles.oldCard}>
          <GoldDiamond size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.oldTitle}>
              {hiddenOld} opération{hiddenOld > 1 ? "s" : ""} plus ancienne{hiddenOld > 1 ? "s" : ""}
            </Text>
            <Text style={styles.oldBody}>
              Au-delà de {PLAN_LIMITS.FREE_HISTORY_MONTHS} mois. Rien n’est supprimé : passez au palier Pro pour les revoir.
            </Text>
          </View>
        </PressScale>
      ) : null}
      {loading ? (
        <PageSkeleton variant="list" rows={6} />
      ) : !hasData ? (
        <EmptyState
          illustration={<ReceiptArt size={200} />}
          title="Aucune transaction"
          description="Ajoutez une dépense ou un revenu. Le solde de vos poches se met à jour tout seul."
          cta="Ajouter une transaction"
          onPress={() => router.push('/transactions/new')}
        />
      ) : noMatch ? (
        <Card style={{ padding: 20, marginTop: 8 }}>
          <Text style={styles.emptyFilter}>Aucun résultat pour ces filtres.</Text>
        </Card>
      ) : null}

      <Sheet open={pick !== null} onClose={() => setPick(null)} title="Filtrer">
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
        {pick === 'cat' ? (
          <OptionList
            options={[{ value: '', label: 'Toutes les catégories' }, ...(categories.data ?? []).map(categoryOption)]}
            value={filters.categoryId}
            onChange={(v) => {
              setFilters((f) => ({ ...f, categoryId: v }));
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
      </Sheet>
      <PlannedHelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} onHidden={() => setHideHelp(true)} />
      <EditPlannedSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void invalidateFinance();
          void planned.refetch();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typeScale.h1, color: color.text, marginBottom: 16 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: 14,
  },
  search: {
    flex: 1,
    fontFamily: font.sans,
    fontSize: 16,
    color: color.text,
    paddingVertical: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  reset: { fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  limit: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, marginBottom: 16 },
  oldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    opacity: 0.85,
  },
  oldTitle: { fontFamily: font.sansSemi, fontSize: 15, color: color.textMuted },
  oldBody: { fontFamily: font.sans, fontSize: 13, lineHeight: 18, color: color.textMuted, marginTop: 2 },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  section: { fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  dayCard: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginBottom: 14,
  },
  dayBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  day: { fontFamily: font.sansSemi, fontSize: 14, color: color.text, flex: 1 },
  count: {
    backgroundColor: color.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countT: { fontFamily: font.sansMed, fontSize: 12, color: color.textMuted },
  emptyFilter: { fontFamily: font.sans, fontSize: 14, color: color.textMuted, textAlign: 'center' },
});
