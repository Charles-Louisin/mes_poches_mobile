import { categoryOption } from '@/lib/plan-options';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Plus,
  Repeat,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import {
  budgetApi,
  categoryApi,
  recurringApi,
  savingsGoalApi,
  type Budget,
  type Category,
  type RecurringTransaction,
  type SavingsGoal,
} from '@/lib/api';
import { invalidateFinance } from '@/lib/query';
import { getTodayUtcDateInputValue } from '@/lib/plannedExpenseDates';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Field } from '@/components/ui/field';
import { InkBar } from '@/components/ui/ink-bar';
import { SectionTitle, type InfoContent } from '@/components/ui/info-sheet';
import { OptionList } from '@/components/ui/option-list';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { PressScale } from '@/components/ui/press-scale';
import { Enter } from '@/components/ui/enter';
import { GiftArt } from '@/components/illustrations';
import { color, radius, shadow, type as font } from '@/theme/tokens';
import { formatDate, nameOf } from '@/lib/utils';

const INFO_BUDGETS: InfoContent = {
  title: 'Budgets',
  what: 'Un plafond de dépense par catégorie, pour le mois en cours.',
  how: [
    'Touchez « Ajouter », choisissez une catégorie de sortie et le montant à ne pas dépasser.',
    'Chaque dépense classée dans cette catégorie, ou un article d’un ticket classé dedans, remplit la barre.',
    'À 100 %, la barre passe au rouge et le dépassement est chiffré.',
    'Un budget vaut pour le mois affiché : reposez-le le mois suivant.',
  ],
};

const INFO_GOALS: InfoContent = {
  title: 'Objectifs d’épargne',
  what: 'Une somme à réunir pour un projet, avec ou sans date limite.',
  how: [
    'Touchez « Ajouter », donnez un nom, le montant visé et, si besoin, une date limite.',
    'Versez de l’argent depuis Nouvelle transaction › Revenu ou Virement › « Vers un objectif d’épargne ».',
    'Dès que vos poches couvrent le reste, l’objectif indique d’où prendre l’argent et vous recevez une notification.',
    'Deux conseils personnalisés arrivent chaque mois : un au début, un à la fin.',
    'Touchez « C’est réalisé » : l’objectif rejoint l’historique.',
  ],
};

const INFO_RECURRING: InfoContent = {
  title: 'Récurrences',
  what: 'Les mouvements qui reviennent chaque semaine ou chaque mois : loyer, salaire, abonnement.',
  how: [
    'L’app repère les mouvements répétés dans votre historique et vous les propose.',
    '« Retenir » garde la récurrence, « Ignorer » l’écarte.',
    '« Enregistrer » crée tout de suite la transaction de l’échéance, avec la bonne poche.',
    'Rien n’est enregistré sans votre action.',
  ],
};

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} style={styles.add} accessibilityRole="button" accessibilityLabel={label}>
      <Plus color={color.white} size={16} strokeWidth={2.6} />
      <Text style={styles.addT}>Ajouter</Text>
    </PressScale>
  );
}

/** En-tête de carte cliquable : plie / déplie la carte (chevron à droite du titre). */
function CardToggle({ open, onPress, label, children }: { open: boolean; onPress: () => void; label: string; children: ReactNode }) {
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.99}
      style={styles.toggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}, ${open ? 'replier' : 'déplier'}`}>
      {children}
      {open ? <ChevronUp color={color.primary} size={20} /> : <ChevronDown color={color.textMuted} size={20} />}
    </PressScale>
  );
}

function DeleteButton({ busy, label, onPress }: { busy: boolean; label: string; onPress: () => void }) {
  return (
    <PressScale
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      style={styles.del}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}>
      {busy ? <ActivityIndicator size="small" color={color.danger} /> : <Trash2 color={color.danger} size={17} strokeWidth={2} />}
    </PressScale>
  );
}

export default function ObjectifsScreen() {
  const { isPremium, requirePremium } = useAuth();
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthName = now.toLocaleDateString('fr-FR', { month: 'long' });
  const [form, setForm] = useState<'budget' | 'goal' | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pickCat, setPickCat] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Action en cours, par clé « type:id » : chaque bouton affiche son propre chargement. */
  const [busy, setBusy] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  /** Cartes dépliées (repliées par défaut : titre, montant et progression restent visibles). */
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => openCards.has(id);
  const toggleCard = (id: string) =>
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const q = useQuery({
    queryKey: ['objectifs', isPremium],
    enabled: isPremium,
    queryFn: async () => {
      const settled = await Promise.allSettled([
        budgetApi.getAll(year, month),
        savingsGoalApi.getAll(),
        recurringApi.getAll('active'),
        recurringApi.getAll('suggested'),
        categoryApi.getAll('expense'),
      ]);
      const list = <T,>(index: number): T[] => {
        const result = settled[index];
        return result.status === 'fulfilled' && Array.isArray(result.value) ? (result.value as T[]) : [];
      };
      return {
        budgets: list<Budget>(0),
        goals: list<SavingsGoal>(1),
        active: list<RecurringTransaction>(2),
        suggested: list<RecurringTransaction>(3),
        categories: list<Category>(4),
      };
    },
  });

  const history = useQuery({
    queryKey: ['objectifs-history'],
    enabled: isPremium && showHistory,
    queryFn: () => savingsGoalApi.getAll('achieved'),
  });

  /** Lance une action avec chargement par bouton, rafraîchit, et signale l'erreur. */
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      if (done) toast(done, 'ok');
      await invalidateFinance();
      await q.refetch();
      if (showHistory) void history.refetch();
    } catch (e) {
      toast(getErrorMessage(e, 'Action impossible'), 'err');
    } finally {
      setBusy(null);
    }
  };

  const removeBudget = async (b: Budget) => {
    const ok = await confirm({
      title: 'Supprimer ce budget ?',
      body: `Le plafond de « ${nameOf(b.category_id as { name: string } | string, 'cette catégorie')} » est retiré. Vos dépenses ne changent pas.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) await run(`budget:${b._id}`, () => budgetApi.delete(b._id), 'Budget supprimé');
  };

  const removeGoal = async (g: SavingsGoal) => {
    const ok = await confirm({
      title: 'Supprimer cet objectif ?',
      body: 'L’argent déjà versé reste compté dans votre épargne.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) await run(`goal:${g._id}`, () => savingsGoalApi.delete(g._id), 'Objectif supprimé');
  };

  const achieveGoal = async (g: SavingsGoal) => {
    const ok = await confirm({
      title: 'Objectif réalisé ?',
      body: `« ${g.title} » rejoint l’historique des objectifs atteints.`,
      confirmLabel: 'C’est réalisé',
    });
    if (ok) await run(`achieve:${g._id}`, () => savingsGoalApi.achieve(g._id), 'Bravo, objectif atteint');
  };

  const removeRecurring = async (r: RecurringTransaction) => {
    const ok = await confirm({
      title: 'Supprimer cette récurrence ?',
      body: 'Les transactions déjà enregistrées restent dans l’historique.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) await run(`rec:${r._id}`, () => recurringApi.delete(r._id), 'Récurrence supprimée');
  };

  const submit = async () => {
    const n = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!n || n <= 0) {
      toast('Indiquez un montant', 'err');
      return;
    }
    if (form === 'budget' && !categoryId) {
      toast('Choisissez une catégorie', 'err');
      return;
    }
    if (form === 'goal' && !title.trim()) {
      toast('Donnez un nom à l’objectif', 'err');
      return;
    }
    setSaving(true);
    try {
      if (form === 'budget') {
        await budgetApi.create({ category_id: categoryId, year, month, limit_amount: n });
        toast('Budget créé', 'ok');
      } else {
        await savingsGoalApi.create({ title: title.trim(), target_amount: n, deadline: deadline.trim() || null });
        toast('Objectif créé', 'ok');
      }
      setForm(null);
      setTitle('');
      setAmount('');
      setDeadline('');
      setCategoryId('');
      await invalidateFinance();
      await q.refetch();
    } catch (err) {
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
      } else toast(getErrorMessage(err, 'Enregistrement impossible'), 'err');
    } finally {
      setSaving(false);
    }
  };

  if (!isPremium) {
    return (
      <Screen>
        <ScreenHeader title="Objectifs" back />
        <EmptyState
          illustration={<GiftArt size={200} />}
          title="Budgets, épargne et récurrences"
          description="Disponibles avec un forfait payant."
          cta="Voir les forfaits"
          onPress={() => requirePremium()}
        />
      </Screen>
    );
  }

  const data = q.data;
  const catName = data?.categories.find((c) => c._id === categoryId)?.name ?? 'Choisir une catégorie';
  const budgets = data?.budgets ?? [];
  const goals = data?.goals ?? [];
  const recurring = [...(data?.active ?? [])];
  const suggested = data?.suggested ?? [];

  return (
    <Screen scroll onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <ScreenHeader title="Objectifs" back />

      {/* ───── Budgets ───── */}
      <SectionTitle
        title="Budgets"
        info={INFO_BUDGETS}
        count={budgets.length}
        action={<AddButton label="Ajouter un budget" onPress={() => setForm('budget')} />}
      />
      {q.isLoading && !data ? <PageSkeleton variant="goals" rows={3} /> : null}
      {budgets.map((b, i) => {
        const spent = b.spent ?? 0;
        const pct = b.percent ?? (spent / Math.max(1, b.limit_amount)) * 100;
        const over = spent > b.limit_amount;
        const left = b.limit_amount - spent;
        return (
          <Enter key={b._id} delay={i * 50}>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <CardToggle open={isOpen(b._id)} onPress={() => toggleCard(b._id)} label={nameOf(b.category_id as { name: string } | string, 'Budget')}>
                <View style={[styles.ico, over && styles.icoDanger]}>
                  <Target color={over ? color.danger : color.primary} size={18} strokeWidth={2} />
                </View>
                <View style={styles.cardTitleBox}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {nameOf(b.category_id as { name: string } | string, 'Catégorie')}
                  </Text>
                  <Text style={styles.cardSub}>Plafond {formatAmount(b.limit_amount)}</Text>
                </View>
                </CardToggle>
                <DeleteButton busy={busy === `budget:${b._id}`} label="Supprimer ce budget" onPress={() => void removeBudget(b)} />
              </View>
              <View style={styles.figures}>
                <Text style={[styles.big, over && { color: color.danger }]}>{formatAmount(spent)}</Text>
                <Text style={styles.pct}>{Math.round(pct)} %</Text>
              </View>
              <InkBar value={pct} tone={over ? 'danger' : pct >= 80 ? 'brass' : 'primary'} delay={80 + i * 60} />
              {isOpen(b._id) ? (
              <Text style={[styles.status, over ? styles.statusWarn : pct >= 80 ? styles.statusInfo : styles.statusGood]}>
                {over
                  ? `Dépassé de ${formatAmount(-left)}`
                  : pct >= 80
                    ? `Attention : il reste ${formatAmount(left)}`
                    : `Il reste ${formatAmount(left)} à dépenser`}
              </Text>
              ) : null}
            </View>
          </Enter>
        );
      })}
      {q.isSuccess && budgets.length === 0 ? (
        <Text style={styles.empty}>Aucun budget ce mois. Un plafond par catégorie vous montre où part l’argent avant la fin du mois.</Text>
      ) : null}

      {/* ───── Objectifs d'épargne ───── */}
      <SectionTitle
        title="Épargne"
        info={INFO_GOALS}
        count={goals.length}
        action={<AddButton label="Ajouter un objectif" onPress={() => setForm('goal')} />}
      />
      {goals.map((g, i) => {
        const current = g.current_amount ?? g.saved_amount ?? 0;
        const pct = g.progress_percent ?? (current / Math.max(1, g.target_amount)) * 100;
        const remaining = g.remaining ?? Math.max(0, g.target_amount - current);
        return (
          <Enter key={g._id} delay={i * 50}>
            <View style={[styles.card, g.achievable && styles.cardReady]}>
              <View style={styles.cardHead}>
                <CardToggle open={isOpen(g._id)} onPress={() => toggleCard(g._id)} label={g.title}>
                <View style={[styles.ico, g.achievable && styles.icoGood]}>
                  {g.achievable ? (
                    <Trophy color={color.success} size={18} strokeWidth={2} />
                  ) : (
                    <WalletIcon color={color.primary} size={18} strokeWidth={2} />
                  )}
                </View>
                <View style={styles.cardTitleBox}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text style={styles.cardSub}>
                    Objectif {formatAmount(g.target_amount)}
                    {g.deadline ? ` · avant le ${formatDate(g.deadline)}` : ''}
                  </Text>
                </View>
                </CardToggle>
                <DeleteButton busy={busy === `goal:${g._id}`} label="Supprimer cet objectif" onPress={() => void removeGoal(g)} />
              </View>
              <View style={styles.figures}>
                <Text style={styles.big}>{formatAmount(current)}</Text>
                <Text style={styles.pct}>{Math.round(pct)} %</Text>
              </View>
              <InkBar value={pct} tone="success" delay={80 + i * 60} />
              {!isOpen(g._id) && g.achievable ? (
                <Text style={[styles.status, styles.statusGood]}>Réalisable maintenant · touchez pour voir le détail</Text>
              ) : null}
              {isOpen(g._id) ? (
              <>
              {g.status_message ? (
                <Text
                  style={[
                    styles.status,
                    g.tone === 'warn' ? styles.statusWarn : g.tone === 'good' ? styles.statusGood : styles.statusInfo,
                  ]}>
                  {g.status_message}
                </Text>
              ) : remaining > 0 ? (
                <Text style={[styles.status, styles.statusInfo]}>Reste {formatAmount(remaining)}</Text>
              ) : null}

              {g.achievable && (g.sources ?? []).length > 0 ? (
                <View style={styles.sources}>
                  <Text style={styles.sourcesT}>D’où prendre l’argent</Text>
                  {(g.sources ?? []).map((s) => (
                    <View key={s.wallet_id} style={styles.sourceRow}>
                      <Text style={styles.sourceName} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={styles.sourceAmt}>{formatAmount(s.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {g.tip ? (
                <View style={styles.tip}>
                  <Sparkles color={color.primary} size={15} strokeWidth={2.2} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipK}>Conseil de {g.tip.period === 'start' ? 'début' : 'fin'} de mois</Text>
                    <Text style={styles.tipT}>{g.tip.text}</Text>
                  </View>
                </View>
              ) : null}

              {g.achievable ? (
                <Button
                  label="C’est réalisé"
                  loadingLabel="Enregistrement…"
                  icon={<CheckCircle2 color={color.white} size={18} />}
                  loading={busy === `achieve:${g._id}`}
                  onPress={() => void achieveGoal(g)}
                  style={{ marginTop: 14, minHeight: 48 }}
                />
              ) : null}
              </>
              ) : null}
            </View>
          </Enter>
        );
      })}
      {q.isSuccess && goals.length === 0 ? (
        <Text style={styles.empty}>Aucun objectif en cours. Fixez un montant à réunir : l’app suit vos versements et vous dit quand c’est possible.</Text>
      ) : null}
      <PressScale
        onPress={() => setShowHistory((v) => !v)}
        style={styles.historyBtn}
        accessibilityRole="button"
        accessibilityState={{ expanded: showHistory }}>
        <Trophy color={color.textSecondary} size={16} />
        <Text style={styles.historyBtnT}>{showHistory ? 'Masquer les objectifs atteints' : 'Objectifs atteints'}</Text>
      </PressScale>
      {showHistory ? (
        history.isLoading ? (
          <ActivityIndicator color={color.primary} style={{ marginVertical: 12 }} />
        ) : (history.data ?? []).length === 0 ? (
          <Text style={styles.empty}>Aucun objectif atteint pour l’instant.</Text>
        ) : (
          <View style={styles.historyList}>
            {(history.data ?? []).map((g) => (
              <View key={g._id} style={styles.historyRow}>
                <CheckCircle2 color={color.success} size={18} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.historyName} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text style={styles.cardSub}>{g.achieved_at ? `Atteint le ${formatDate(g.achieved_at)}` : 'Atteint'}</Text>
                </View>
                <Text style={styles.historyAmt}>{formatAmount(g.target_amount)}</Text>
              </View>
            ))}
          </View>
        )
      ) : null}

      {/* ───── Récurrences ───── */}
      <SectionTitle title="Récurrences" info={INFO_RECURRING} count={recurring.length} />
      {recurring.map((r, i) => (
        <Enter key={r._id} delay={i * 50}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <CardToggle open={isOpen(r._id)} onPress={() => toggleCard(r._id)} label={r.description || 'Récurrence'}>
              <View style={styles.ico}>
                <Repeat color={color.primary} size={18} strokeWidth={2} />
              </View>
              <View style={styles.cardTitleBox}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {r.description || 'Mouvement récurrent'}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {r.type === 'income' ? '+' : '−'}
                  {formatAmount(r.amount)} · {r.frequency === 'weekly' ? 'chaque semaine' : 'chaque mois'}
                </Text>
              </View>
              </CardToggle>
              <DeleteButton busy={busy === `rec:${r._id}`} label="Supprimer cette récurrence" onPress={() => void removeRecurring(r)} />
            </View>
            {isOpen(r._id) ? (
            <View style={styles.recRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.big, { color: r.type === 'income' ? color.success : color.text }]}>
                  {r.type === 'income' ? '+' : '−'}
                  {formatAmount(r.amount)}
                </Text>
                <View style={styles.next}>
                  <CalendarClock color={color.textMuted} size={14} />
                  <Text style={styles.cardSub}>Prochaine échéance : {formatDate(r.next_run_date)}</Text>
                </View>
                {nameOf(r.wallet_id as { name: string } | string, '') ? (
                  <Text style={styles.cardSub}>Poche : {nameOf(r.wallet_id as { name: string } | string, '')}</Text>
                ) : null}
              </View>
              <Button
                label="Enregistrer"
                loadingLabel="…"
                compact
                loading={busy === `run:${r._id}`}
                onPress={() => void run(`run:${r._id}`, () => recurringApi.run(r._id), 'Transaction enregistrée')}
                style={styles.recBtn}
              />
            </View>
            ) : null}
          </View>
        </Enter>
      ))}
      {suggested.length > 0 ? <Text style={styles.suggestT}>Proposées à partir de votre historique</Text> : null}
      {suggested.map((r) => (
        <View key={r._id} style={[styles.card, styles.cardSuggest]}>
          <View style={styles.cardHead}>
            <View style={[styles.ico, styles.icoSuggest]}>
              <Sparkles color="#B45309" size={18} strokeWidth={2} />
            </View>
            <View style={styles.cardTitleBox}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {r.description || 'Mouvement répété'}
              </Text>
              <Text style={styles.cardSub}>
                {r.frequency === 'weekly' ? 'Chaque semaine' : 'Chaque mois'} · {r.type === 'income' ? '+' : '−'}
                {formatAmount(r.amount)}
              </Text>
            </View>
          </View>
          <View style={styles.suggestActions}>
            <Button
              label="Ignorer"
              variant="line"
              compact
              loading={busy === `dismiss:${r._id}`}
              loadingLabel="…"
              onPress={() => void run(`dismiss:${r._id}`, () => recurringApi.dismiss(r._id))}
            />
            <Button
              label="Retenir"
              compact
              loading={busy === `accept:${r._id}`}
              loadingLabel="…"
              onPress={() => void run(`accept:${r._id}`, () => recurringApi.accept(r._id), 'Récurrence retenue')}
            />
          </View>
        </View>
      ))}
      {q.isSuccess && recurring.length === 0 && suggested.length === 0 ? (
        <Text style={styles.empty}>Aucune récurrence. Elles apparaissent ici dès qu’un même mouvement revient plusieurs fois.</Text>
      ) : null}
      <View style={{ height: 24 }} />

      <Sheet open={form !== null} onClose={() => setForm(null)} title={form === 'budget' ? 'Nouveau budget' : 'Nouvel objectif'}>
        <View style={{ gap: 16 }}>
          {form === 'budget' ? (
            <PressScale onPress={() => setPickCat(true)} style={styles.pick} accessibilityRole="button">
              <Text style={styles.pickL}>Catégorie de sortie</Text>
              <Text style={[styles.pickV, !categoryId && { color: color.textMuted }]}>{catName}</Text>
            </PressScale>
          ) : (
            <>
              <Field label="Nom de l’objectif" value={title} onChangeText={setTitle} placeholder="Ex. Moto, loyer d’avance" />
              <DateField
                label="Date limite (facultatif)"
                value={deadline || getTodayUtcDateInputValue()}
                onChange={setDeadline}
              />
            </>
          )}
          <Field
            label={form === 'budget' ? `Plafond pour ${monthName}` : 'Montant à réunir'}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <Button
            label={form === 'budget' ? 'Créer le budget' : 'Créer l’objectif'}
            loadingLabel="Enregistrement…"
            onPress={() => void submit()}
            loading={saving}
          />
        </View>
      </Sheet>
      <Sheet open={pickCat} onClose={() => setPickCat(false)} title="Catégorie">
        <OptionList
          options={(data?.categories ?? []).map(categoryOption)}
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            setPickCat(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
  },
  addT: { fontFamily: font.sansSemi, fontSize: 14, color: color.white },
  card: {
    backgroundColor: color.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    padding: 16,
    marginBottom: 12,
    ...shadow.soft,
  },
  cardReady: { borderColor: '#A7E9C9', backgroundColor: '#FAFEFB' },
  cardSuggest: { borderStyle: 'dashed', borderColor: '#F5D39B', backgroundColor: '#FFFCF5', shadowOpacity: 0, elevation: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  ico: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icoDanger: { backgroundColor: '#FEF3F2' },
  icoGood: { backgroundColor: '#ECFDF3' },
  icoSuggest: { backgroundColor: '#FFF4E0' },
  cardTitleBox: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  cardSub: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 2 },
  del: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  figures: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  big: { fontFamily: font.sansBold, fontSize: 22, color: color.text, fontVariant: ['tabular-nums'] },
  pct: { fontFamily: font.sansSemi, fontSize: 14, color: color.textSecondary },
  status: { fontFamily: font.sansMed, fontSize: 14, lineHeight: 20, marginTop: 10 },
  statusGood: { color: '#067647' },
  statusInfo: { color: color.textSecondary },
  statusWarn: { color: color.danger },
  sources: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: '#ECFDF3', gap: 6 },
  sourcesT: { fontFamily: font.sansSemi, fontSize: 13, color: "#067647" },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  sourceName: { flex: 1, fontFamily: font.sansMed, fontSize: 14, color: color.text },
  sourceAmt: { fontFamily: font.sansSemi, fontSize: 14, color: color.text },
  tip: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: color.primaryVeryLight,
    alignItems: 'flex-start',
  },
  tipK: { fontFamily: font.sansSemi, fontSize: 12, color: color.primary, marginBottom: 2 },
  tipT: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.text },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 10, minHeight: 44 },
  historyBtnT: { fontFamily: font.sansSemi, fontSize: 14, color: color.textSecondary },
  historyList: { backgroundColor: color.surface, borderRadius: radius.card, paddingHorizontal: 14 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  historyName: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  historyAmt: { fontFamily: font.sansSemi, fontSize: 14, color: color.success },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  recBtn: { flex: 0, paddingHorizontal: 18 },
  suggestT: { fontFamily: font.sansSemi, fontSize: 13, color: '#B45309', marginTop: 8, marginBottom: 10 },
  suggestActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  empty: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 21,
    color: color.textSecondary,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 8,
  },
  pick: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    justifyContent: 'center',
  },
  pickL: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
  pickV: { fontFamily: font.sansMed, fontSize: 16, color: color.text, marginTop: 2 },
});
