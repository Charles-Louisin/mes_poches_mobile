import { walletOption, categoryOption } from '@/lib/plan-options';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CalendarClock, ChevronDown, ChevronUp, Info, Plus, Tag, Trash2, X } from 'lucide-react-native';
import { InfoSheet, type InfoContent } from '@/components/ui/info-sheet';
import {
  categoryApi,
  savingsGoalApi,
  sanitizeLineItems,
  transactionApi,
  walletApi,
  type Category,
  type SavingsGoal,
  type Wallet,
} from '@/lib/api';
import { getTodayUtcDateInputValue, isFutureUtcDay } from '@/lib/plannedExpenseDates';
import { invalidateFinance } from '@/lib/query';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/auth';
import { useBatchProgress } from '@/contexts/batch-progress';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { quotaPromptFromError } from '@/components/subscription/quota-prompt';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Field } from '@/components/ui/field';
import { OptionList } from '@/components/ui/option-list';
import { PlannedHelpSheet } from '@/components/ui/planned-help-sheet';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { color, radius, shadow, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

type Kind = 'expense' | 'income' | 'transfer';
/** categoryId vide = la ligne prend la catégorie de sa poche. */
type Line = { id: string; description: string; amount: string; categoryId: string };
/** Un feuillet : une poche, sa catégorie, sa date, ses lignes → une transaction. */
type Group = { id: string; walletId: string; categoryId: string; date: string; description: string; lines: Line[] };
type Pick =
  | { kind: 'wallet'; groupId: string }
  | { kind: 'cat'; groupId: string }
  | { kind: 'lineCat'; groupId: string; lineId: string }
  | { kind: 'from' }
  | { kind: 'to' }
  | { kind: 'goal' };

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const newLine = (): Line => ({ id: uid(), description: '', amount: '', categoryId: '' });
const parseAmount = (raw: string) => parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const layout = LinearTransition.duration(220).easing(EASE_OUT);

const INFO_SHEETS: InfoContent = {
  title: 'Saisir des transactions',
  what: 'Une fiche par poche. Vous pouvez remplir plusieurs fiches, puis tout enregistrer en une fois.',
  how: [
    'Choisissez la poche, la catégorie et la date de la fiche.',
    'Ajoutez une ligne par article ou par paiement. Une ligne peut avoir sa propre catégorie.',
    'Une autre poche ? Touchez « Ajouter une autre poche ».',
    'Touchez une fiche repliée pour la rouvrir, « Replier » pour la refermer : rien n’est perdu.',
    'Une date future crée une dépense prévue, débitée le jour venu.',
    'Touchez « Tout enregistrer ». Au-delà de 3 fiches, l’enregistrement continue en arrière-plan.',
  ],
};

const INFO_TRANSFER: InfoContent = {
  title: 'Virement',
  what: 'L’argent passe d’une poche à une autre, ou vers un objectif d’épargne.',
  how: [
    'Indiquez le montant et la poche de départ.',
    'Choisissez la poche d’arrivée, ou « Vers l’épargne » et l’objectif.',
    'Le solde des deux poches est mis à jour immédiatement.',
  ],
};

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function validLines(g: Group) {
  return g.lines
    .map((l) => ({ ...l, value: parseAmount(l.amount) }))
    .filter((l) => Number.isFinite(l.value) && l.value > 0);
}

function subtotal(g: Group): number {
  return validLines(g).reduce((s, l) => s + l.value, 0);
}

export default function NewTransactionScreen() {
  const toast = useToast();
  const { isPremium, user } = useAuth();
  const { formatAmount } = useCurrency();
  const batch = useBatchProgress();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const today = getTodayUtcDateInputValue();
  const [kind, setKind] = useState<Kind>(
    params.type === 'income' ? 'income' : params.type === 'transfer' ? 'transfer' : 'expense'
  );
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  // Première fiche affichée tout de suite ; sa poche est renseignée dès que les poches sont chargées.
  const [initialGroup] = useState<Group>(() => ({
    id: uid(),
    walletId: '',
    categoryId: '',
    date: getTodayUtcDateInputValue(),
    description: '',
    lines: [newLine()],
  }));
  const [groups, setGroups] = useState<Group[]>([initialGroup]);
  const [activeId, setActiveId] = useState<string>(initialGroup.id);
  const [pick, setPick] = useState<Pick | null>(null);
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [hideHelp, setHideHelp] = useState(!!user?.hidePlannedExpensesHelp);
  // Virement
  const [tfAmount, setTfAmount] = useState('');
  const [tfFrom, setTfFrom] = useState('');
  const [tfTo, setTfTo] = useState('');
  const [tfGoal, setTfGoal] = useState('');
  const [tfToGoal, setTfToGoal] = useState(false);
  const [tfDate, setTfDate] = useState(today);
  const [tfNote, setTfNote] = useState('');
  const lastAdded = useRef<string | null>(null);

  const openWallets = useMemo(() => wallets.filter((w) => !w.locked), [wallets]);
  const walletOf = (id: string) => wallets.find((w) => w._id === id);
  const catName = (id: string) => categories.find((c) => c._id === id)?.name;

  const makeGroup = (used: string[] = []): Group => {
    const free = openWallets.find((w) => !used.includes(w._id)) ?? openWallets[0];
    return { id: uid(), walletId: free?._id ?? '', categoryId: '', date: today, description: '', lines: [newLine()] };
  };

  useEffect(() => {
    void (async () => {
      try {
        const w = await walletApi.getAll();
        const list = Array.isArray(w) ? w : [];
        setWallets(list);
        const first = list.find((x) => !x.locked);
        setTfFrom((cur) => cur || first?._id || '');
        // Fiches encore sans poche : la première poche disponible.
        setGroups((prev) => prev.map((g) => (g.walletId ? g : { ...g, walletId: first?._id ?? '' })));
      } catch (err) {
        toast(getErrorMessage(err, 'Impossible de charger les poches'), 'err');
      }
    })();
  }, []);

  useEffect(() => {
    if (kind === 'transfer') {
      if (isPremium) void savingsGoalApi.getAll().then((g) => setGoals(Array.isArray(g) ? g : [])).catch(() => setGoals([]));
      return;
    }
    void categoryApi
      .getAll(kind)
      .then((c) => setCategories(Array.isArray(c) ? c : []))
      .catch(() => setCategories([]));
  }, [kind, isPremium]);

  const chooseKind = (next: Kind) => {
    if (next === kind) return;
    setKind(next);
    // Les catégories dépendent du sens (sortie / entrée) ; un revenu ne peut pas être daté dans le futur.
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        categoryId: '',
        date: next === 'income' && isFutureUtcDay(g.date) ? today : g.date,
        lines: g.lines.map((l) => ({ ...l, categoryId: '' })),
      }))
    );
  };

  const patchGroup = (id: string, patch: Partial<Group>) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const patchLine = (groupId: string, lineId: string, patch: Partial<Line>) =>
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, lines: g.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) } : g))
    );
  const addLine = (groupId: string) => {
    const line = newLine();
    lastAdded.current = line.id;
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, lines: [...g.lines, line] } : g)));
  };
  const removeLine = (groupId: string, lineId: string) =>
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId && g.lines.length > 1 ? { ...g, lines: g.lines.filter((l) => l.id !== lineId) } : g))
    );
  const addGroup = () => {
    const g = makeGroup(groups.map((x) => x.walletId));
    setGroups((prev) => [...prev, g]);
    setActiveId(g.id);
  };
  const removeGroup = (id: string) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== id);
      if (activeId === id) setActiveId(next[next.length - 1]?.id ?? '');
      return next.length ? next : [makeGroup()];
    });
  };

  /** Solde dépassé : dépenses du jour (pas les prévues), cumulées par poche sur tous les feuillets. */
  const overdrawn = useMemo(() => {
    const out = new Set<string>();
    if (kind !== 'expense') return out;
    const perWallet = new Map<string, number>();
    for (const g of groups) {
      if (isFutureUtcDay(g.date)) continue;
      perWallet.set(g.walletId, (perWallet.get(g.walletId) ?? 0) + subtotal(g));
    }
    for (const g of groups) {
      if (isFutureUtcDay(g.date)) continue;
      const w = walletOf(g.walletId);
      if (w && (perWallet.get(g.walletId) ?? 0) > w.current_balance) out.add(g.id);
    }
    return out;
  }, [groups, kind, wallets]);

  const filled = groups.filter((g) => validLines(g).length > 0);
  const total = filled.reduce((s, g) => s + subtotal(g), 0);
  const lineCount = filled.reduce((s, g) => s + validLines(g).length, 0);

  const submitGroups = async () => {
    if (!filled.length) {
      toast('Ajoutez au moins un montant', 'err');
      return;
    }
    const missing = filled.find((g) => !g.walletId);
    if (missing) {
      setActiveId(missing.id);
      toast('Choisissez une poche pour chaque feuillet', 'err');
      return;
    }
    if (filled.some((g) => overdrawn.has(g.id))) {
      const g = filled.find((x) => overdrawn.has(x.id))!;
      setActiveId(g.id);
      toast(`Solde insuffisant sur ${walletOf(g.walletId)?.name ?? 'une poche'}`, 'err');
      return;
    }
    setSaving(true);
    try {
      const payload = filled.map((g) => {
        const lines = validLines(g);
        return {
          kind: kind as 'expense' | 'income',
          wallet_id: g.walletId,
          category_id: g.categoryId || null,
          description: g.description.trim() || (lines.length > 1 ? `${lines.length} articles` : lines[0].description.trim()),
          // Aujourd’hui : l’heure réelle (le serveur date à maintenant), pour un historique bien trié.
          date: g.date === today ? undefined : g.date,
          line_items: sanitizeLineItems(
            lines.map((l) => ({
              description: l.description.trim(),
              amount: l.value,
              // Catégorie propre à la ligne, sinon celle du feuillet.
              category_id: l.categoryId || g.categoryId || null,
            }))
          ),
        };
      });
      const res = await transactionApi.createBatch(payload);
      track('transaction_create', {
        screen: 'transactions_new',
        props: { element: `${kind}-batch-${payload.length}` },
      });
      if (res.status === 'running' && res.id) {
        // Gros lot : le serveur continue seul, l'anneau en haut à droite suit l'avancement réel.
        batch.start(res);
      } else {
        await invalidateFinance();
        if (res.failed) toast(`${res.done} enregistrée(s), ${res.failed} en échec : ${res.errors[0]?.message ?? ''}`, 'err');
        else if (filled.every((g) => kind === 'expense' && isFutureUtcDay(g.date)))
          toast(filled.length > 1 ? 'Dépenses prévues enregistrées' : 'Dépense prévue enregistrée', 'ok');
        else toast(filled.length > 1 ? `${res.done} transactions enregistrées` : kind === 'income' ? 'Revenu enregistré' : 'Dépense enregistrée', 'ok');
      }
      router.replace('/(tabs)/transactions');
    } catch (err) {
      if (quotaPromptFromError(err)) return;
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
      } else toast(getErrorMessage(err, 'Enregistrement impossible'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const tfValue = parseAmount(tfAmount);
  const tfWallet = walletOf(tfFrom);
  const tfOver = !!tfWallet && Number.isFinite(tfValue) && tfValue > tfWallet.current_balance;
  const submitTransfer = async () => {
    if (!tfValue || tfValue <= 0) return toast('Indiquez un montant', 'err');
    if (!tfFrom) return toast('Choisissez la poche de départ', 'err');
    if (tfToGoal ? !tfGoal : !tfTo) return toast(tfToGoal ? 'Choisissez l’objectif' : 'Choisissez la poche d’arrivée', 'err');
    if (tfOver) return toast('Montant supérieur au solde de la poche', 'err');
    setSaving(true);
    try {
      await transactionApi.createTransfer({
        amount: tfValue,
        wallet_id: tfFrom,
        ...(tfToGoal ? { savings_goal_id: tfGoal } : { destination_wallet_id: tfTo }),
        description: tfNote.trim() || undefined,
        date: tfDate,
      });
      track('transaction_create', { screen: 'transactions_new', props: { element: tfToGoal ? 'savings' : 'transfer' } });
      await invalidateFinance();
      toast(tfToGoal ? 'Épargne alimentée' : 'Virement effectué', 'ok');
      router.replace('/(tabs)/transactions');
    } catch (err) {
      if (quotaPromptFromError(err)) return;
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
      } else toast(getErrorMessage(err, 'Virement impossible'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const pickedGroup = pick && 'groupId' in pick ? groups.find((g) => g.id === pick.groupId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <Screen scroll keyboardAware>
        <ScreenHeader
          title="Nouvelle transaction"
          back
          action={
            <PressScale
              onPress={() => setInfoOpen(true)}
              hitSlop={10}
              style={styles.infoBtn}
              accessibilityRole="button"
              accessibilityLabel="Comment ça marche">
              <Info color={color.primary} size={18} strokeWidth={2.2} />
            </PressScale>
          }
        />
        <View style={styles.kinds} accessibilityRole="tablist">
          {(
            [
              { key: 'expense' as const, label: 'Dépense' },
              { key: 'income' as const, label: 'Revenu' },
              { key: 'transfer' as const, label: 'Virement' },
            ] as const
          ).map((k) => (
            <PressScale
              key={k.key}
              onPress={() => chooseKind(k.key)}
              style={[styles.kind, kind === k.key && styles.kindOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === k.key }}>
              <Text style={[styles.kindT, kind === k.key && styles.kindTon]}>{k.label}</Text>
            </PressScale>
          ))}
        </View>

        {kind !== 'transfer' ? (
          <>

            {groups.map((g, gi) => {
              const active = g.id === activeId;
              const w = walletOf(g.walletId);
              const sub = subtotal(g);
              const n = validLines(g).length;
              const future = isFutureUtcDay(g.date);
              const over = overdrawn.has(g.id);
              const cat = catName(g.categoryId);
              if (!active) {
                return (
                  <Animated.View key={g.id} layout={layout} entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)}>
                    <PressScale
                      onPress={() => setActiveId(g.id)}
                      style={[styles.folded, over && styles.foldedErr]}
                      accessibilityRole="button"
                      accessibilityLabel={`Fiche ${gi + 1}, ${w?.name ?? 'sans poche'}, ${n} ligne${n > 1 ? 's' : ''}, ${formatAmount(sub)}. Toucher pour modifier`}>
                      <Text style={styles.foldedN}>{gi + 1}</Text>
                      <EntityAvatar imageUrl={w?.image_url} name={w?.name ?? '?'} type="wallet" size={36} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.foldedName} numberOfLines={1}>
                          {w?.name ?? 'Poche à choisir'}
                        </Text>
                        <Text style={styles.foldedMeta} numberOfLines={1}>
                          {cat ?? 'Sans catégorie'} · {n} ligne{n > 1 ? 's' : ''}
                          {future ? ` · prévue le ${formatDate(g.date)}` : ''}
                        </Text>
                      </View>
                      {over ? <AlertCircle color={color.danger} size={18} /> : null}
                      <Text style={styles.foldedAmt}>{formatAmount(sub)}</Text>
                      <ChevronDown color={color.textMuted} size={18} />
                    </PressScale>
                  </Animated.View>
                );
              }
              return (
                <Animated.View key={g.id} layout={layout} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.sheet}>
                  <View style={styles.sheetHead}>
                    <PressScale
                      onPress={() => setActiveId('')}
                      hitSlop={10}
                      style={styles.sheetFold}
                      accessibilityRole="button"
                      accessibilityLabel={`Replier la fiche ${gi + 1}`}>
                      <Text style={styles.sheetN}>Fiche {gi + 1}</Text>
                      <ChevronUp color={color.primary} size={16} />
                      <Text style={styles.sheetFoldT}>Replier</Text>
                    </PressScale>
                    {groups.length > 1 ? (
                      <PressScale
                        onPress={() => removeGroup(g.id)}
                        hitSlop={10}
                        style={styles.sheetDel}
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer la fiche ${gi + 1}`}>
                        <X color={color.textMuted} size={16} />
                        <Text style={styles.sheetDelT}>Retirer</Text>
                      </PressScale>
                    ) : null}
                  </View>

                  <PressScale
                    onPress={() => setPick({ kind: 'wallet', groupId: g.id })}
                    style={styles.walletPick}
                    accessibilityRole="button"
                    accessibilityLabel={`Poche : ${w?.name ?? 'à choisir'}. Changer`}>
                    <EntityAvatar imageUrl={w?.image_url} name={w?.name ?? '?'} type="wallet" size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.pickK}>Poche</Text>
                      <Text style={styles.walletName} numberOfLines={1}>
                        {w?.name ?? 'Choisir une poche'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.pickK}>Solde</Text>
                      <Text style={[styles.balance, over && { color: color.danger }]}>{w ? formatAmount(w.current_balance) : '—'}</Text>
                    </View>
                    <ChevronDown color={color.primary} size={18} />
                  </PressScale>

                  <View style={styles.metaRow}>
                    <PressScale
                      onPress={() => setPick({ kind: 'cat', groupId: g.id })}
                      style={styles.metaPick}
                      accessibilityRole="button"
                      accessibilityLabel={`Catégorie : ${cat ?? 'aucune'}. Changer`}>
                      <Tag color={color.primary} size={16} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.pickK}>Catégorie</Text>
                        <Text style={[styles.metaV, !cat && { color: color.textMuted }]} numberOfLines={1}>
                          {cat ?? 'Aucune'}
                        </Text>
                      </View>
                    </PressScale>
                    <View>
                      <DateField
                        label="Date"
                        value={g.date}
                        onChange={(v) => patchGroup(g.id, { date: kind === 'income' && isFutureUtcDay(v) ? today : v })}
                        maximumDate={kind === 'income' ? todayLocal() : undefined}
                      />
                    </View>
                  </View>
                  {future && kind === 'expense' ? (
                    <View style={styles.planned}>
                      <CalendarClock color={color.primary} size={16} />
                      <Text style={styles.plannedT}>
                        Dépense prévue : rien n’est débité avant le {formatDate(g.date)}.
                        {!hideHelp ? ' ' : ''}
                        {!hideHelp ? (
                          <Text style={styles.link} onPress={() => setHelpOpen(true)}>
                            Comment ça marche
                          </Text>
                        ) : null}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.linesT}>{kind === 'expense' ? 'Ce que vous avez payé' : 'Ce que vous avez reçu'}</Text>
                  {g.lines.map((l, li) => (
                    <Animated.View key={l.id} layout={layout} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.line}>
                      <View style={styles.lineRow}>
                        <TextInput
                          value={l.description}
                          onChangeText={(t) => patchLine(g.id, l.id, { description: t })}
                          placeholder={li === 0 ? (kind === 'expense' ? 'Ex. Pain' : 'Ex. Salaire') : 'Libellé'}
                          placeholderTextColor={color.textMuted}
                          style={[styles.input, styles.inputLabel]}
                          autoFocus={lastAdded.current === l.id}
                          accessibilityLabel={`Libellé de la ligne ${li + 1}`}
                        />
                        <TextInput
                          value={l.amount}
                          onChangeText={(t) => patchLine(g.id, l.id, { amount: t })}
                          placeholder="0"
                          placeholderTextColor={color.textMuted}
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.inputAmount]}
                          accessibilityLabel={`Montant de la ligne ${li + 1}`}
                        />
                        {g.lines.length > 1 ? (
                          <PressScale
                            onPress={() => removeLine(g.id, l.id)}
                            hitSlop={8}
                            style={styles.trash}
                            accessibilityRole="button"
                            accessibilityLabel={`Supprimer la ligne ${li + 1}`}>
                            <Trash2 color={color.danger} size={17} />
                          </PressScale>
                        ) : null}
                      </View>
                      {g.lines.length > 1 ? (
                        <PressScale
                          onPress={() => setPick({ kind: 'lineCat', groupId: g.id, lineId: l.id })}
                          style={styles.lineCat}
                          accessibilityRole="button"
                          accessibilityLabel={`Catégorie de la ligne : ${l.categoryId ? catName(l.categoryId) : 'celle de la fiche'}`}>
                          <Tag color={l.categoryId || cat ? color.primary : color.textMuted} size={13} />
                          <Text style={[styles.lineCatT, !l.categoryId && !cat && { color: color.textMuted }]} numberOfLines={1}>
                            {/* La catégorie effective de la ligne, rien d’autre : la sienne, sinon celle de la fiche. */}
                            {l.categoryId ? catName(l.categoryId) ?? 'Catégorie' : cat ?? 'Choisir une catégorie'}
                          </Text>
                        </PressScale>
                      ) : null}
                    </Animated.View>
                  ))}
                  <PressScale onPress={() => addLine(g.id)} style={styles.addLine} accessibilityRole="button">
                    <Plus color={color.primary} size={16} strokeWidth={2.4} />
                    <Text style={styles.addLineT}>Ajouter une ligne</Text>
                  </PressScale>

                  {g.lines.length > 1 ? (
                    <Field
                      label="Libellé de l’ensemble (facultatif)"
                      value={g.description}
                      onChangeText={(t) => patchGroup(g.id, { description: t })}
                      placeholder="Ex. Courses du marché"
                      containerStyle={{ marginTop: 14 }}
                    />
                  ) : null}

                  <View style={styles.subRow}>
                    <Text style={styles.subK}>Total de la fiche</Text>
                    <Text style={[styles.subV, over && { color: color.danger }]}>{formatAmount(sub)}</Text>
                  </View>
                  {over ? (
                    <View style={styles.err}>
                      <AlertCircle color={color.danger} size={15} />
                      <Text style={styles.errT}>
                        Dépasse le solde de {w?.name} ({formatAmount(w?.current_balance ?? 0)}). Réduisez le montant, changez de poche
                        ou choisissez une date future.
                      </Text>
                    </View>
                  ) : null}
                </Animated.View>
              );
            })}

            <PressScale onPress={addGroup} style={styles.addGroup} accessibilityRole="button">
              <View style={styles.addGroupIco}>
                <Plus color={color.primary} size={18} strokeWidth={2.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addGroupT}>Ajouter une autre poche</Text>
                <Text style={styles.addGroupH}>Une nouvelle fiche, avec sa catégorie et ses lignes</Text>
              </View>
            </PressScale>
            <View style={{ height: 120 }} />
          </>
        ) : (
          <View style={{ gap: 16 }}>
            <Field label="Montant" value={tfAmount} onChangeText={setTfAmount} keyboardType="decimal-pad" placeholder="0" error={tfOver ? `Supérieur au solde de ${tfWallet?.name} (${formatAmount(tfWallet?.current_balance ?? 0)})` : undefined} />
            <PressScale onPress={() => setPick({ kind: 'from' })} style={styles.walletPick} accessibilityRole="button">
              <EntityAvatar imageUrl={tfWallet?.image_url} name={tfWallet?.name ?? '?'} type="wallet" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickK}>Depuis</Text>
                <Text style={styles.walletName}>{tfWallet?.name ?? 'Choisir'}</Text>
              </View>
              <Text style={styles.balance}>{tfWallet ? formatAmount(tfWallet.current_balance) : ''}</Text>
              <ChevronDown color={color.primary} size={18} />
            </PressScale>
            {isPremium ? (
              <View style={styles.kinds}>
                <PressScale onPress={() => setTfToGoal(false)} style={[styles.kind, !tfToGoal && styles.kindOn]} accessibilityRole="tab" accessibilityState={{ selected: !tfToGoal }}>
                  <Text style={[styles.kindT, !tfToGoal && styles.kindTon]}>Vers une poche</Text>
                </PressScale>
                <PressScale
                  onPress={() => {
                    if (!goals.length) return toast('Créez d’abord un objectif dans Objectifs', 'info');
                    setTfToGoal(true);
                  }}
                  style={[styles.kind, tfToGoal && styles.kindOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tfToGoal }}>
                  <Text style={[styles.kindT, tfToGoal && styles.kindTon]}>Vers l’épargne</Text>
                </PressScale>
              </View>
            ) : null}
            <PressScale onPress={() => setPick(tfToGoal ? { kind: 'goal' } : { kind: 'to' })} style={styles.walletPick} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={styles.pickK}>{tfToGoal ? 'Objectif' : 'Vers'}</Text>
                <Text style={styles.walletName}>
                  {tfToGoal ? goals.find((g) => g._id === tfGoal)?.title ?? 'Choisir un objectif' : walletOf(tfTo)?.name ?? 'Choisir une poche'}
                </Text>
              </View>
              <ChevronDown color={color.primary} size={18} />
            </PressScale>
            <DateField label="Date" value={tfDate} onChange={(v) => setTfDate(isFutureUtcDay(v) ? today : v)} maximumDate={todayLocal()} />
            <Field label="Note (facultatif)" value={tfNote} onChangeText={setTfNote} placeholder="Ex. Recharge Orange" />
            <Button label={tfToGoal ? 'Verser dans l’objectif' : 'Effectuer le virement'} loadingLabel="Enregistrement…" loading={saving} onPress={() => void submitTransfer()} />
          </View>
        )}
      </Screen>

      {kind !== 'transfer' ? (
        <View style={[styles.bar, { paddingBottom: 12 + Math.min(insets.bottom, 4) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.barK} numberOfLines={1}>
              {filled.length} fiche{filled.length > 1 ? 's' : ''} · {lineCount} ligne{lineCount > 1 ? 's' : ''}
            </Text>
            <Text style={[styles.barV, kind === 'income' && { color: color.success }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(total)}
            </Text>
          </View>
          <PressScale
            onPress={() => void submitGroups()}
            disabled={saving || !filled.length}
            style={[styles.save, (!filled.length || saving) && { opacity: 0.55 }]}
            accessibilityRole="button"
            accessibilityState={{ busy: saving, disabled: !filled.length }}
            accessibilityLabel="Tout enregistrer">
            {saving ? <ActivityIndicator color={color.white} /> : null}
            <Text style={styles.saveT}>{saving ? 'Enregistrement…' : filled.length > 1 ? `Tout enregistrer (${filled.length})` : 'Enregistrer'}</Text>
          </PressScale>
        </View>
      ) : null}

      <Sheet
        open={pick !== null}
        onClose={() => setPick(null)}
        title={
          pick?.kind === 'wallet' || pick?.kind === 'from'
            ? 'Poche'
            : pick?.kind === 'to'
              ? 'Poche d’arrivée'
              : pick?.kind === 'goal'
                ? 'Objectif'
                : 'Catégorie'
        }>
        {pick?.kind === 'wallet' ? (
          <>
            <OptionList
              options={wallets.map(walletOption)}
              value={pickedGroup?.walletId ?? ''}
              onChange={(v) => {
                patchGroup(pick.groupId, { walletId: v });
                setPick(null);
              }}
            />
            <Button label="Créer une poche" variant="ghost" onPress={() => { setPick(null); router.push('/wallets/new'); }} />
          </>
        ) : null}
        {pick?.kind === 'cat' ? (
          <>
            <OptionList
              options={[{ value: '', label: 'Aucune catégorie' }, ...categories.map(categoryOption)]}
              value={pickedGroup?.categoryId ?? ''}
              onChange={(v) => {
                patchGroup(pick.groupId, { categoryId: v });
                setPick(null);
              }}
            />
            <Button label="Créer une catégorie" variant="ghost" onPress={() => { setPick(null); router.push('/categories/new' as never); }} />
          </>
        ) : null}
        {pick?.kind === 'lineCat' ? (
          <OptionList
            options={[
              { value: '', label: `Celle de la fiche${pickedGroup && catName(pickedGroup.categoryId) ? ` (${catName(pickedGroup.categoryId)})` : ''}` },
              ...categories.map(categoryOption),
            ]}
            value={pickedGroup?.lines.find((l) => l.id === pick.lineId)?.categoryId ?? ''}
            onChange={(v) => {
              patchLine(pick.groupId, pick.lineId, { categoryId: v });
              setPick(null);
            }}
          />
        ) : null}
        {pick?.kind === 'from' ? (
          <OptionList options={wallets.map(walletOption)} value={tfFrom} onChange={(v) => { setTfFrom(v); setPick(null); }} />
        ) : null}
        {pick?.kind === 'to' ? (
          <OptionList options={wallets.filter((w) => w._id !== tfFrom).map(walletOption)} value={tfTo} onChange={(v) => { setTfTo(v); setPick(null); }} />
        ) : null}
        {pick?.kind === 'goal' ? (
          <OptionList options={goals.map((g) => ({ value: g._id, label: g.title }))} value={tfGoal} onChange={(v) => { setTfGoal(v); setPick(null); }} />
        ) : null}
      </Sheet>
      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} info={kind === 'transfer' ? INFO_TRANSFER : INFO_SHEETS} />
      <PlannedHelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} onHidden={() => setHideHelp(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.pill, padding: 4, marginBottom: 14 },
  kind: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  kindOn: { backgroundColor: color.primary },
  kindT: { fontFamily: font.sansSemi, color: color.textSecondary, fontSize: 14 },
  kindTon: { color: color.white },
  folded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    marginBottom: 10,
  },
  foldedErr: { borderWidth: 1.5, borderColor: '#FDA29B' },
  foldedN: { width: 18, fontFamily: font.sansBold, fontSize: 14, color: color.textMuted, textAlign: 'center' },
  foldedName: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  foldedMeta: { fontFamily: font.sans, fontSize: 12, color: color.textSecondary, marginTop: 2 },
  foldedAmt: { fontFamily: font.sansBold, fontSize: 15, color: color.text },
  sheet: {
    backgroundColor: color.white,
    borderRadius: radius.largeCard,
    borderWidth: 1.5,
    borderColor: color.primary,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetN: { fontFamily: font.sansBold, fontSize: 13, color: color.primary, letterSpacing: 0.3 },
  sheetDel: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  sheetDelT: { fontFamily: font.sansMed, fontSize: 13, color: color.textMuted },
  walletPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: color.primaryVeryLight,
  },
  pickK: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
  walletName: { fontFamily: font.sansSemi, fontSize: 16, color: color.text, marginTop: 1 },
  balance: { fontFamily: font.sansSemi, fontSize: 14, color: color.text, marginTop: 1 },
  metaRow: { gap: 10, marginTop: 10 },
  metaPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  metaV: { fontFamily: font.sansMed, fontSize: 15, color: color.text },
  planned: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: 10, borderRadius: radius.md, backgroundColor: color.primaryLight },
  plannedT: { flex: 1, fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.primaryDark },
  link: { fontFamily: font.sansSemi, color: color.primary, textDecorationLine: 'underline' },
  linesT: { fontFamily: font.sansSemi, fontSize: 14, color: color.text, marginTop: 18, marginBottom: 8 },
  line: { marginBottom: 8 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: 12,
    fontFamily: font.sans,
    fontSize: 16,
    color: color.text,
  },
  inputLabel: { flex: 1, minWidth: 0 },
  inputAmount: { width: 112, textAlign: 'right', fontFamily: font.sansSemi },
  trash: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  lineCat: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingTop: 4, paddingLeft: 4 },
  lineCatT: { flexShrink: 1, fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFold: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  sheetFoldT: { fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  addLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: color.primaryVeryLight,
    marginTop: 2,
  },
  addLineT: { fontFamily: font.sansSemi, fontSize: 14, color: color.primary },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  subK: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary },
  subV: { fontFamily: font.sansBold, fontSize: 18, color: color.text, fontVariant: ['tabular-nums'] },
  err: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: 10, borderRadius: radius.md, backgroundColor: '#FEF3F2' },
  errT: { flex: 1, fontFamily: font.sansMed, fontSize: 13, lineHeight: 19, color: color.danger },
  addGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93B4F5',
    marginTop: 4,
  },
  addGroupIco: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.primaryLight, alignItems: 'center', justifyContent: 'center' },
  addGroupT: { fontFamily: font.sansSemi, fontSize: 15, color: color.primary },
  addGroupH: { fontFamily: font.sans, fontSize: 12, color: color.textSecondary, marginTop: 2 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: color.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    ...shadow.card,
  },
  barK: { fontFamily: font.sansMed, fontSize: 12, color: color.textSecondary },
  barV: { fontFamily: font.sansBold, fontSize: 20, color: color.text, fontVariant: ['tabular-nums'] },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: radius.button,
    backgroundColor: color.primary,
  },
  saveT: { fontFamily: font.sansSemi, fontSize: 15, color: color.white },
});
