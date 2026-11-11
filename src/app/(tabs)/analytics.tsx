import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  PiggyBank,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react-native';
import { analyticsApi, categoryApi, type MonthBriefing, type MonthOverview } from '@/lib/api';
import { LockedTag, promptLocked } from '@/components/subscription/plan-usage';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { isAbortError } from '@/lib/errors';
import { compareMonths, fmtPct, listMonths, localDateKey, monthLabel, shiftMonth } from '@/lib/months';
import { STORAGE_KEYS, getJson, setJson } from '@/lib/storage';
import { formatDate, formatRelativeDate, operationsLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/auth';
import { useCurrency } from '@/contexts/currency';
import { Amount } from '@/components/ui/amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { InkBar } from '@/components/ui/ink-bar';
import { OptionList } from '@/components/ui/option-list';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { MonthTrigger } from '@/components/analytics/month-trigger';
import { SectionHead, useSectionSort } from '@/components/analytics/section-sort';
import { color, radius, type as font, typeScale } from '@/theme/tokens';

type StoredBriefing = {
  briefing: MonthBriefing;
  generatedOn: string;
  year: number;
  month: number;
  hidden: boolean;
};

function briefingStorageKey(userId: string) {
  return `${STORAGE_KEYS.analyticsBriefing}:${userId}`;
}

export default function AnalyticsScreen() {
  const { isPremium, user } = useAuth();
  const { formatAmount } = useCurrency();
  // Catégories hors forfait (après un passage à un palier inférieur) : grisées dans les répartitions.
  const catsQ = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.getAll(), enabled: isPremium });
  const lockedCats = useMemo(() => {
    const set = new Set<string>();
    for (const c of catsQ.data ?? []) if (c.locked) set.add(`${c.type}:${c.name}`);
    return set;
  }, [catsQ.data]);
  const catQuota = user?.quotas?.categories;
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [vs, setVs] = useState(() => shiftMonth(now.getFullYear(), now.getMonth() + 1, -1));
  const [picker, setPicker] = useState<'month' | 'vs' | null>(null);
  const [briefing, setBriefing] = useState<MonthBriefing | null>(null);
  const [generatedOn, setGeneratedOn] = useState<string | null>(null);
  const [briefMeta, setBriefMeta] = useState<{ year: number; month: number } | null>(null);
  const [briefHidden, setBriefHidden] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);

  const created = user?.created_at ? new Date(user.created_at) : new Date(now.getFullYear(), 0, 1);
  const months = useMemo(() => listMonths(created, now), [created, now]);
  const label = monthLabel(cursor.year, cursor.month);
  const vsLabel = monthLabel(vs.year, vs.month);
  const usedToday = generatedOn === localDateKey();
  const vsMonths = useMemo(() => {
    const filtered = months.filter((m) => m.year !== cursor.year || m.month !== cursor.month);
    const hasVs = filtered.some((m) => m.year === vs.year && m.month === vs.month);
    if (hasVs) return filtered;
    return [{ year: vs.year, month: vs.month, label: vsLabel }, ...filtered];
  }, [months, cursor.year, cursor.month, vs.year, vs.month, vsLabel]);

  useEffect(() => {
    setVs(shiftMonth(cursor.year, cursor.month, -1));
  }, [cursor.year, cursor.month]);

  useEffect(() => {
    if (!user?.id) return;
    void getJson<StoredBriefing>(briefingStorageKey(user.id)).then((stored) => {
      if (!stored?.briefing) return;
      setBriefing(stored.briefing);
      setGeneratedOn(stored.generatedOn);
      setBriefMeta({ year: stored.year, month: stored.month });
      setBriefHidden(!!stored.hidden);
    });
  }, [user?.id]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const persistBrief = useCallback(
    (next: StoredBriefing) => {
      if (!user?.id) return;
      void setJson(briefingStorageKey(user.id), next);
    },
    [user?.id]
  );

  const q = useQuery({
    queryKey: ['analytics', isPremium, cursor.year, cursor.month],
    queryFn: async () => {
      if (!isPremium) {
        const current = await analyticsApi.getCurrentMonth();
        return { current, overview: null as MonthOverview | null };
      }
      try {
        const overview = await analyticsApi.getOverview(cursor.year, cursor.month);
        return { current: overview.selected, overview };
      } catch {
        const start = new Date(cursor.year, cursor.month - 1, 1).toISOString();
        const end = new Date(cursor.year, cursor.month, 0, 23, 59, 59).toISOString();
        const [current, comparison, expenses, incomes] = await Promise.all([
          analyticsApi.getMonth(cursor.year, cursor.month),
          analyticsApi.getMonthComparison(cursor.year, cursor.month).catch(() => null),
          analyticsApi.getExpensesByCategory(start, end).catch(() => []),
          analyticsApi.getIncomesByCategory(start, end).catch(() => []),
        ]);
        return {
          current,
          overview: comparison
            ? ({
                selected: current,
                previous: comparison.previous,
                comparison,
                expenses,
                incomes,
                kpis: {
                  savingsRate: current.totalIncome > 0 ? current.balance / current.totalIncome : null,
                  expenseRatio: current.totalIncome > 0 ? current.totalExpense / current.totalIncome : null,
                  dailyExpenseAvg: 0,
                  dailyIncomeAvg: 0,
                  avgExpenseTicket: current.expenseCount ? current.totalExpense / current.expenseCount : 0,
                  avgIncomeTicket: current.incomeCount ? current.totalIncome / current.incomeCount : 0,
                  activeDays: 0,
                  daysInMonth: new Date(cursor.year, cursor.month, 0).getDate(),
                  daysElapsed: 1,
                  isCurrent: false,
                  projectedExpense: current.totalExpense,
                  cash: 0,
                  totalSavings: 0,
                  runwayDays: null,
                  transferVolume: 0,
                  transferCount: 0,
                  savingsDeposited: 0,
                  plannedAmount: 0,
                  plannedCount: 0,
                  budgetsOver: 0,
                  budgetsOk: 0,
                },
                wallets: [],
                budgets: [],
                savings: [],
                weekday: [],
                topExpenses: [],
                topIncomes: [],
                categoryShifts: [],
                largestExpense: null,
                largestIncome: null,
              } satisfies MonthOverview)
            : null,
        };
      }
    },
  });

  const vsQ = useQuery({
    queryKey: ['analytics-vs', vs.year, vs.month],
    queryFn: () => analyticsApi.getMonth(vs.year, vs.month),
    enabled: isPremium,
  });

  const generateBriefing = useCallback(async () => {
    if (!isPremium || usedToday || generatingRef.current) return;
    generatingRef.current = true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAiBusy(true);
    setAiError(null);
    try {
      const data = await analyticsApi.getBriefing(cursor.year, cursor.month, ac.signal);
      if (ac.signal.aborted) return;
      const today = localDateKey();
      const stored: StoredBriefing = {
        briefing: data,
        generatedOn: today,
        year: cursor.year,
        month: cursor.month,
        hidden: false,
      };
      setBriefing(data);
      setGeneratedOn(today);
      setBriefMeta({ year: cursor.year, month: cursor.month });
      setBriefHidden(false);
      persistBrief(stored);
    } catch (err) {
      if (isAbortError(err) || ac.signal.aborted) return;
      setAiError('Analyse IA indisponible pour le moment.');
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
        generatingRef.current = false;
        setAiBusy(false);
      }
    }
  }, [cursor.month, cursor.year, isPremium, persistBrief, usedToday]);

  const cancelBriefing = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    generatingRef.current = false;
    setAiBusy(false);
  }, []);

  const toggleBriefHidden = useCallback(() => {
    setBriefHidden((hidden) => {
      const next = !hidden;
      if (briefing && generatedOn && briefMeta) {
        persistBrief({
          briefing,
          generatedOn,
          year: briefMeta.year,
          month: briefMeta.month,
          hidden: next,
        });
      }
      return next;
    });
  }, [briefMeta, briefing, generatedOn, persistBrief]);

  const s = q.data?.current;
  const o = q.data?.overview;
  const vsStats = vsQ.data;
  const comparison = s && vsStats ? compareMonths(s, vsStats) : null;
  const maxWeek = Math.max(1, ...(o?.weekday.map((d) => d.expense) ?? [1]));

  // Tri propre à chaque section (bouton « Trier » → feuille du bas).
  const expSort = useSectionSort(o?.expenses ?? [], { name: (c) => c.category, amount: (c) => c.total });
  const incSort = useSectionSort(o?.incomes ?? [], { name: (c) => c.category, amount: (c) => c.total });
  const budgetSort = useSectionSort(o?.budgets ?? [], { name: (b) => b.category, amount: (b) => b.spent });
  const savingsSort = useSectionSort(o?.savings ?? [], {
    name: (g) => g.title,
    amount: (g) => g.current,
    date: (g) => g.deadline,
  });
  const walletSort = useSectionSort(o?.wallets ?? [], { name: (w) => w.name, amount: (w) => w.net });
  const weekSort = useSectionSort(
    o?.weekday ?? [],
    { name: (d) => d.day, amount: (d) => d.expense },
    'Ordre de la semaine'
  );
  const topSort = useSectionSort(o?.topExpenses ?? [], {
    name: (t) => t.description,
    amount: (t) => t.amount,
    date: (t) => t.date,
    category: (t) => t.category,
    wallet: (t) => t.wallet,
  });

  return (
    <Screen scroll onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <ScreenHeader title="Analyse" />

      {isPremium ? (
        <>
          <MonthTrigger label={label} onPress={() => setPicker('month')} />
          <Sheet open={picker === 'month'} onClose={() => setPicker(null)} title="Mois">
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <OptionList
                value={`${cursor.year}-${cursor.month}`}
                onChange={(value) => {
                  const [year, month] = value.split('-').map(Number);
                  setCursor({ year, month });
                  setPicker(null);
                }}
                options={months.map((m) => ({
                  value: `${m.year}-${m.month}`,
                  label: m.label,
                }))}
              />
            </ScrollView>
          </Sheet>
          <Sheet open={picker === 'vs'} onClose={() => setPicker(null)} title="Comparer avec">
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <OptionList
                value={`${vs.year}-${vs.month}`}
                onChange={(value) => {
                  const [year, month] = value.split('-').map(Number);
                  setVs({ year, month });
                  setPicker(null);
                }}
                options={vsMonths.map((m) => ({
                  value: `${m.year}-${m.month}`,
                  label: m.label,
                }))}
              />
            </ScrollView>
          </Sheet>
        </>
      ) : (
        <Text style={styles.nowLabel}>Ce mois</Text>
      )}

      {q.isLoading && !q.data ? (
        <PageSkeleton variant="goals" rows={5} />
      ) : (
        <>
      <Amount amount={s?.balance ?? 0} format={formatAmount} size={40} />
      <Text style={styles.balanceHint}>Solde du mois (entrées − sorties)</Text>

      <View style={styles.flowRow}>
        <FlowCard
          tone="in"
          label="Entrées"
          amount={formatAmount(s?.totalIncome ?? 0)}
          hint={operationsLabel(s?.incomeCount ?? 0)}
        />
        <FlowCard
          tone="out"
          label="Sorties"
          amount={formatAmount(s?.totalExpense ?? 0)}
          hint={operationsLabel(s?.expenseCount ?? 0)}
        />
      </View>
        </>
      )}

      {!isPremium ? (
        <LockedAnalyses />
      ) : o ? (
        <>
          <View style={{ marginTop: 12, marginBottom: 8 }}>
            <Button
              label={usedToday ? 'Analyse déjà générée' : 'Générer le briefing'}
              icon={<Sparkles color={color.white} size={18} />}
              loading={aiBusy}
              loadingLabel="Lecture du mois…"
              onPress={() => void generateBriefing()}
              disabled={usedToday || aiBusy}
            />
            {aiBusy ? (
              <PressScale onPress={cancelBriefing} style={styles.cancelBtn} accessibilityRole="button" accessibilityLabel="Annuler l’analyse">
                <Text style={styles.cancelLabel}>Annuler</Text>
              </PressScale>
            ) : null}
            {usedToday ? (
              <Text style={styles.quotaHint}>Une analyse IA par jour. Reviens demain pour en lancer une nouvelle.</Text>
            ) : null}
            {aiError ? <Text style={styles.briefWait}>{aiError}</Text> : null}
          </View>

          {briefing ? (
            <>
              <PressScale
                onPress={toggleBriefHidden}
                accessibilityRole="button"
                accessibilityLabel={briefHidden ? 'Afficher l’analyse' : 'Masquer l’analyse'}
                style={styles.revealBtn}>
                <View style={styles.revealIcon}>
                  {briefHidden ? (
                    <Eye color={color.primary} size={16} strokeWidth={2.2} />
                  ) : (
                    <EyeOff color={color.primary} size={16} strokeWidth={2.2} />
                  )}
                </View>
                <Text style={styles.revealLabel}>
                  {briefHidden ? 'Afficher l’analyse' : 'Masquer l’analyse'}
                </Text>
                {briefHidden ? (
                  <ChevronDown color={color.primary} size={16} strokeWidth={2.2} />
                ) : (
                  <ChevronUp color={color.primary} size={16} strokeWidth={2.2} />
                )}
              </PressScale>
              {!briefHidden ? (
                <Card style={[styles.block, moodBg(briefing.mood)]}>
                  <View style={styles.briefHead}>
                    <Sparkles color={color.primary} size={18} />
                    <Text style={styles.secInline}>{briefing.headline}</Text>
                  </View>
                  {briefMeta ? (
                    <Text style={styles.briefMeta}>
                      {monthLabel(briefMeta.year, briefMeta.month)}
                      {generatedOn ? ` · ${formatRelativeDate(`${generatedOn}T12:00:00`)}` : ''}
                    </Text>
                  ) : null}
                  {briefing.summary ? (
                    <>
                      <Text style={styles.themeTitle}>En résumé</Text>
                      <Text style={styles.body}>{briefing.summary}</Text>
                    </>
                  ) : null}
                  {briefing.highlights.length > 0 ? (
                    <>
                      <Text style={styles.themeTitle}>Points clés</Text>
                      {briefing.highlights.map((item) => (
                        <Text key={item} style={styles.tip}>
                          {item}
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {briefing.alerts.length > 0 ? (
                    <>
                      <Text style={styles.themeTitle}>À surveiller</Text>
                      {briefing.alerts.map((item) => (
                        <Text key={item} style={styles.alert}>
                          {item}
                        </Text>
                      ))}
                    </>
                  ) : null}
                  {briefing.tips.length > 0 ? (
                    <>
                      <Text style={styles.themeTitle}>Ce que je te conseille</Text>
                      {briefing.tips.map((item) => (
                        <Text key={item} style={styles.tipMuted}>
                          {item}
                        </Text>
                      ))}
                    </>
                  ) : null}
                </Card>
              ) : null}
            </>
          ) : null}

          <View style={styles.kpiGrid}>
            <Kpi title="Taux d’épargne" value={o.kpis.savingsRate == null ? '—' : fmtPct(o.kpis.savingsRate * 100)} hint="du revenu" />
            <Kpi title="Dépense / jour" value={formatAmount(o.kpis.dailyExpenseAvg)} hint={`${o.kpis.activeDays} jours actifs`} />
            <Kpi title="Ticket moyen" value={formatAmount(o.kpis.avgExpenseTicket)} hint="par sortie" />
            <Kpi
              title="Autonomie"
              value={o.kpis.runwayDays == null ? '—' : `${o.kpis.runwayDays} j`}
              hint="au rythme actuel"
            />
          </View>

          {o.kpis.isCurrent ? (
            <Card style={styles.block}>
              <Text style={styles.sec}>Projection de fin de mois</Text>
              <Text style={styles.body}>
                Au rythme actuel, les sorties iraient vers {formatAmount(o.kpis.projectedExpense)} sur{' '}
                {o.kpis.daysInMonth} jours.
              </Text>
              {o.kpis.plannedCount > 0 ? (
                <Text style={styles.meta}>
                  {o.kpis.plannedCount} dépense{o.kpis.plannedCount > 1 ? 's' : ''} prévue
                  {o.kpis.plannedCount > 1 ? 's' : ''} : {formatAmount(o.kpis.plannedAmount)}
                </Text>
              ) : null}
            </Card>
          ) : null}

          <View style={styles.vsRow}>
            <Text style={styles.vsLabel}>Vs</Text>
            <MonthTrigger inline label={vsLabel} onPress={() => setPicker('vs')} />
          </View>
          <Card padded={false} style={styles.block}>
            {comparison && vsStats && s ? (
              <>
                <Compare
                  label="Revenus"
                  selected={s.totalIncome}
                  previous={vsStats.totalIncome}
                  delta={comparison.delta.totalIncome}
                  percent={comparison.percent.totalIncome}
                  higherIsGood
                  format={formatAmount}
                  vsLabel={vsLabel}
                />
                <Compare
                  label="Dépenses"
                  selected={s.totalExpense}
                  previous={vsStats.totalExpense}
                  delta={comparison.delta.totalExpense}
                  percent={comparison.percent.totalExpense}
                  higherIsGood={false}
                  format={formatAmount}
                  vsLabel={vsLabel}
                />
                <Compare
                  label="Solde"
                  selected={s.balance}
                  previous={vsStats.balance}
                  delta={comparison.delta.balance}
                  percent={comparison.percent.balance}
                  higherIsGood
                  format={formatAmount}
                  vsLabel={vsLabel}
                  last
                />
              </>
            ) : (
              <Text style={styles.vsWait}>{vsQ.isError ? 'Comparaison indisponible.' : 'Chargement de la comparaison…'}</Text>
            )}
          </Card>

          <SectionHead title="Sorties par catégorie" button={expSort.button} />
          {expSort.sheet}
          <Card style={styles.block}>
            {expSort.hiddenByRange > 0 && expSort.items.length === 0 ? <Text style={styles.empty}>Rien dans cette tranche</Text> : null}
            {expSort.items.map((c) => {
              const share = o.selected.totalExpense > 0 ? (c.total / o.selected.totalExpense) * 100 : 0;
              const locked = lockedCats.has(`expense:${c.category}`);
              return (
                <PressScale
                  key={c.category}
                  disabled={!locked}
                  onPress={() => promptLocked('categories', catQuota)}
                  accessibilityHint={locked ? 'Catégorie hors de votre forfait' : undefined}
                  style={[styles.catRow, locked && styles.catLocked]}>
                  <View style={styles.budgetRow}>
                    <Text style={[styles.cat, locked && styles.catMuted]}>{c.category}</Text>
                    {locked ? <LockedTag /> : <Text style={styles.amt}>{formatAmount(c.total)}</Text>}
                  </View>
                  <InkBar value={share} tone="danger" />
                  <Text style={styles.share}>
                    {Math.round(share)} % · {operationsLabel(c.count)}
                  </Text>
                </PressScale>
              );
            })}
            {o.expenses.length === 0 ? <Text style={styles.empty}>Aucune sortie classée</Text> : null}
          </Card>

          <SectionHead title="Entrées par catégorie" button={incSort.button} />
          {incSort.sheet}
          <Card style={styles.block}>
            {incSort.hiddenByRange > 0 && incSort.items.length === 0 ? <Text style={styles.empty}>Rien dans cette tranche</Text> : null}
            {incSort.items.map((c) => {
              const share = o.selected.totalIncome > 0 ? (c.total / o.selected.totalIncome) * 100 : 0;
              const locked = lockedCats.has(`income:${c.category}`);
              return (
                <PressScale
                  key={c.category}
                  disabled={!locked}
                  onPress={() => promptLocked('categories', catQuota)}
                  accessibilityHint={locked ? 'Catégorie hors de votre forfait' : undefined}
                  style={[styles.catRow, locked && styles.catLocked]}>
                  <View style={styles.budgetRow}>
                    <Text style={[styles.cat, locked && styles.catMuted]}>{c.category}</Text>
                    {locked ? <LockedTag /> : <Text style={styles.amt}>{formatAmount(c.total)}</Text>}
                  </View>
                  <InkBar value={share} tone="success" />
                  <Text style={styles.share}>
                    {Math.round(share)} % · {operationsLabel(c.count)}
                  </Text>
                </PressScale>
              );
            })}
            {o.incomes.length === 0 ? <Text style={styles.empty}>Aucune entrée classée</Text> : null}
          </Card>

          <SectionHead
            title="Budgets du mois"
            icon={<Target color={color.primary} size={16} />}
            button={o.budgets.length > 1 ? budgetSort.button : null}
          />
          {budgetSort.sheet}
          {o.budgets.length === 0 ? (
            <PressScale onPress={() => router.push('/objectifs')} style={styles.ghost}>
              <Text style={styles.ghostT}>Aucun budget — en créer un</Text>
            </PressScale>
          ) : (
            <Card style={styles.block}>
              {budgetSort.hiddenByRange > 0 && budgetSort.items.length === 0 ? <Text style={styles.empty}>Rien dans cette tranche</Text> : null}
              {budgetSort.items.map((b) => (
                <View key={b.id} style={styles.catRow}>
                  <View style={styles.budgetRow}>
                    <Text style={styles.cat}>{b.category}</Text>
                    <Text style={[styles.amt, b.over && styles.bad]}>
                      {formatAmount(b.spent)} / {formatAmount(b.limit)}
                    </Text>
                  </View>
                  <InkBar value={b.percent} tone={b.over ? 'danger' : 'primary'} />
                  <Text style={styles.share}>
                    {b.over ? 'Dépassé' : `Reste ${formatAmount(b.remaining)}`}
                    {b.vsPrevious !== 0
                      ? ` · ${b.vsPrevious > 0 ? '+' : ''}${formatAmount(b.vsPrevious)} vs mois préc.`
                      : ''}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          <SectionHead
            title="Épargne"
            icon={<PiggyBank color={color.primary} size={16} />}
            button={o.savings.length > 1 ? savingsSort.button : null}
          />
          {savingsSort.sheet}
          <Card style={styles.block}>
            <Text style={styles.meta}>
              Versé ce mois : {formatAmount(o.kpis.savingsDeposited)} · Encours {formatAmount(o.kpis.totalSavings)}
            </Text>
            {o.savings.length === 0 ? (
              <PressScale onPress={() => router.push('/objectifs')}>
                <Text style={styles.ghostT}>Créer un objectif d’épargne</Text>
              </PressScale>
            ) : (
              savingsSort.items.map((g) => (
                <View key={g.id} style={styles.catRow}>
                  <View style={styles.budgetRow}>
                    <Text style={styles.cat}>{g.title}</Text>
                    <Text style={styles.amt}>{Math.round(g.progress)} %</Text>
                  </View>
                  <InkBar value={g.progress} tone="primary" />
                  <Text style={styles.share}>
                    {formatAmount(g.current)} / {formatAmount(g.target)}
                    {g.monthIn > 0 ? ` · +${formatAmount(g.monthIn)} ce mois` : ' · aucun versement'}
                    {g.onTrack === false ? ' · rythme insuffisant' : g.onTrack ? ' · dans les temps' : ''}
                    {g.deadline ? ` · ${formatDate(g.deadline)}` : ''}
                  </Text>
                </View>
              ))
            )}
          </Card>

          {o.wallets.length > 0 ? (
            <>
              <SectionHead
                title="Poches"
                icon={<Wallet color={color.primary} size={16} />}
                button={walletSort.button}
              />
              {walletSort.sheet}
              <Card padded={false} style={styles.block}>
                {walletSort.hiddenByRange > 0 && walletSort.items.length === 0 ? (
                  <Text style={[styles.empty, { padding: 16 }]}>Rien dans cette tranche</Text>
                ) : null}
                {walletSort.items.map((w, i) => (
                  <View key={w.id} style={[styles.cmpRow, i === walletSort.items.length - 1 && styles.lastRow]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cat}>{w.name}</Text>
                      <Text style={styles.share}>
                        +{formatAmount(w.income)} · −{formatAmount(w.expense)}
                      </Text>
                    </View>
                    <Text style={[styles.amt, w.net >= 0 ? styles.good : styles.bad]}>
                      {w.net >= 0 ? '+' : ''}
                      {formatAmount(w.net)}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {o.weekday.length > 0 ? (
            <>
              <SectionHead title="Rythme de la semaine" button={weekSort.button} />
              {weekSort.sheet}
              <Card style={styles.block}>
                {weekSort.hiddenByRange > 0 && weekSort.items.length === 0 ? <Text style={styles.empty}>Rien dans cette tranche</Text> : null}
                {weekSort.items.map((d) => (
                  <View key={d.day} style={styles.weekRow}>
                    <Text style={styles.weekDay}>{d.day}</Text>
                    <View style={{ flex: 1 }}>
                      <InkBar value={(d.expense / maxWeek) * 100} tone="danger" />
                    </View>
                    <Text style={styles.weekAmt}>{d.expense ? formatAmount(d.expense) : '—'}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {o.topExpenses.length > 0 ? (
            <>
              <SectionHead title="Plus grosses sorties" button={topSort.button} />
              {topSort.sheet}
              <Card padded={false} style={styles.block}>
                {topSort.hiddenByRange > 0 && topSort.items.length === 0 ? (
                  <Text style={[styles.empty, { padding: 16 }]}>Rien dans cette tranche</Text>
                ) : null}
                {topSort.items.map((t, i) => (
                  <PressScale
                    key={t.id}
                    onPress={() => router.push(`/transactions/${t.id}`)}
                    style={[styles.cmpRow, i === topSort.items.length - 1 && styles.lastRow]}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.cat} numberOfLines={1}>
                        {t.description}
                      </Text>
                      <Text style={styles.share} numberOfLines={1}>
                        {[formatDate(t.date), t.category, t.wallet].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[styles.amt, styles.bad]}>{formatAmount(t.amount)}</Text>
                  </PressScale>
                ))}
              </Card>
            </>
          ) : null}

          {o.kpis.transferCount > 0 ? (
            <Text style={styles.meta}>
              {o.kpis.transferCount} virement{o.kpis.transferCount > 1 ? 's' : ''} ·{' '}
              {formatAmount(o.kpis.transferVolume)}
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function FlowCard({
  tone,
  label,
  amount,
  hint,
}: {
  tone: 'in' | 'out';
  label: string;
  amount: string;
  hint: string;
}) {
  const Icon = tone === 'in' ? ArrowDownLeft : ArrowUpRight;
  const fg = tone === 'in' ? color.success : color.danger;
  const bg = tone === 'in' ? '#E8F8EF' : '#FDECEC';
  return (
    <View style={styles.flowCard}>
      <View style={[styles.flowIcon, { backgroundColor: bg }]}>
        <Icon color={fg} size={16} strokeWidth={2.4} />
      </View>
      <Text style={styles.metaK}>{label}</Text>
      <Text style={[styles.flowAmt, { color: fg }]} numberOfLines={1}>
        {amount}
      </Text>
      <Text style={styles.share}>{hint}</Text>
    </View>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.metaK}>{title}</Text>
      <Text style={styles.kpiV} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.share}>{hint}</Text>
    </View>
  );
}

function Compare({
  label,
  selected,
  previous,
  delta,
  percent,
  higherIsGood,
  format,
  vsLabel,
  last,
}: {
  label: string;
  selected: number;
  previous: number;
  delta: number;
  percent: number | null;
  higherIsGood: boolean;
  format: (n: number) => string;
  vsLabel: string;
  last?: boolean;
}) {
  const good = delta === 0 ? null : higherIsGood ? delta > 0 : delta < 0;
  return (
    <View style={[styles.compare, last && styles.lastRow]}>
      <View style={styles.budgetRow}>
        <Text style={styles.cat}>{label}</Text>
        <Text style={[styles.delta, good === true && styles.good, good === false && styles.bad]}>
          {delta > 0 ? '+' : ''}
          {format(delta)} · {fmtPct(percent)}
        </Text>
      </View>
      <Text style={styles.share}>
        {format(selected)} ce mois · {format(previous)} {vsLabel}
      </Text>
    </View>
  );
}

function moodBg(mood: 'good' | 'watch' | 'alert') {
  if (mood === 'good') return { backgroundColor: '#E8F8EF' };
  if (mood === 'alert') return { backgroundColor: '#FDECEC' };
  return { backgroundColor: '#FFF7E8' };
}

const styles = StyleSheet.create({
  nowLabel: {
    fontFamily: font.sansMed,
    fontSize: 13,
    color: color.textMuted,
    marginBottom: 8,
  },
  balanceHint: {
    fontFamily: font.sans,
    fontSize: 13,
    color: color.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  flowRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  flowCard: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: 14,
  },
  flowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  flowAmt: { fontFamily: font.sansSemi, fontSize: 16, marginTop: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  kpi: {
    width: '47.5%',
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: 14,
  },
  kpiV: { ...typeScale.h3, color: color.text, marginTop: 4 },
  block: { marginBottom: 4 },
  sec: {
    marginTop: 28,
    marginBottom: 10,
    fontFamily: font.sansSemi,
    fontSize: 16,
    color: color.text,
  },
  secRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 10,
  },
  secInline: { fontFamily: font.sansSemi, fontSize: 16, color: color.text, flex: 1 },
  body: { fontFamily: font.sans, fontSize: 14, color: color.textSecondary, lineHeight: 20, marginTop: 6 },
  meta: { fontFamily: font.sans, fontSize: 13, color: color.textMuted, marginTop: 8, marginBottom: 8 },
  metaK: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
  catRow: { marginBottom: 14 },
  catLocked: { opacity: 0.55 },
  catMuted: { color: color.textMuted },
  lockedCard: { marginTop: 16, gap: 0 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  lockedRowLast: { borderBottomWidth: 0 },
  lockedTitle: { fontFamily: font.sansSemi, fontSize: 15, color: color.textMuted },
  lockedDesc: { fontFamily: font.sans, fontSize: 13, lineHeight: 18, color: color.textMuted, marginTop: 2 },
  lockedIntro: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.textSecondary, marginTop: 24 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  cat: { fontFamily: font.sansMed, color: color.text, fontSize: 14, flex: 1 },
  amt: { fontFamily: font.sansSemi, fontSize: 14, color: color.text },
  share: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, marginTop: 6 },
  cmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  lastRow: { borderBottomWidth: 0 },
  compare: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  delta: { fontFamily: font.sansSemi, fontSize: 13, color: color.text },
  good: { color: color.success },
  bad: { color: color.danger },
  empty: { fontFamily: font.sans, color: color.textMuted, fontSize: 13 },
  ghost: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: 16,
  },
  ghostT: { fontFamily: font.sansMed, color: color.primary, fontSize: 14 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  weekDay: { width: 32, fontFamily: font.sansMed, fontSize: 12, color: color.textSecondary },
  weekAmt: { width: 78, textAlign: 'right', fontFamily: font.sans, fontSize: 12, color: color.text },
  briefHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  briefWait: { fontFamily: font.sans, color: color.textMuted, fontSize: 13, marginTop: 12 },
  briefMeta: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, marginTop: 6 },
  quotaHint: {
    fontFamily: font.sans,
    fontSize: 13,
    color: color.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
  cancelBtn: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelLabel: {
    fontFamily: font.sansSemi,
    fontSize: 15,
    color: color.textSecondary,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    marginBottom: 10,
  },
  vsLabel: { fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  vsWait: {
    fontFamily: font.sans,
    fontSize: 13,
    color: color.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  revealBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  revealIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealLabel: {
    flex: 1,
    fontFamily: font.sansSemi,
    fontSize: 14,
    color: color.primary,
  },
  themeTitle: {
    fontFamily: font.sansSemi,
    fontSize: 13,
    color: color.text,
    marginTop: 14,
    marginBottom: 4,
  },
  alert: { fontFamily: font.sansMed, color: color.danger, fontSize: 13, marginTop: 8, lineHeight: 18 },
  tip: { fontFamily: font.sans, color: color.text, fontSize: 13, marginTop: 6, lineHeight: 18 },
  tipMuted: { fontFamily: font.sans, color: color.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
});

/** Plan gratuit : les analyses du forfait Pro restent visibles, grisées avec le diamant. */
const PRO_ANALYSES = [
  ['Comparaison des mois', 'Ce mois face à n’importe quel mois précédent.'],
  ['Sorties et entrées par catégorie', 'Où part l’argent, en pourcentage du mois.'],
  ['Budgets du mois', 'Un plafond par catégorie, l’alerte avant le dépassement.'],
  ['Épargne et objectifs', 'La progression de chaque objectif.'],
  ['Briefing IA', 'Le résumé du mois et les conseils, en un geste.'],
] as const;

function LockedAnalyses() {
  const { user } = useAuth();
  const next = user?.quotas?.scans;
  const open = () =>
    next?.nextTier
      ? router.push(`/subscription/payment?tier=${next.nextTier}`)
      : router.push('/subscription');
  return (
    <>
      <Text style={styles.lockedIntro}>Ces analyses ne sont pas incluses dans le plan gratuit.</Text>
      <Card style={styles.lockedCard}>
        {PRO_ANALYSES.map(([title, desc], i) => (
          <PressScale
            key={title}
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel={`${title}, disponible avec le palier Pro`}
            style={[styles.lockedRow, i === PRO_ANALYSES.length - 1 && styles.lockedRowLast]}>
            <GoldDiamond size={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedTitle}>{title}</Text>
              <Text style={styles.lockedDesc}>{desc}</Text>
            </View>
          </PressScale>
        ))}
      </Card>
      <View style={{ height: 16 }} />
      <Button label="Débloquer avec Pro" onPress={open} />
    </>
  );
}
