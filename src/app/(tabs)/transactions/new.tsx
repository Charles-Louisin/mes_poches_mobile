import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import {
  categoryApi,
  plannedExpenseApi,
  savingsGoalApi,
  sanitizeLineItems,
  transactionApi,
  walletApi,
  type SavingsGoal,
  type Wallet,
} from '@/lib/api';
import { getTodayUtcDateInputValue, isFutureUtcDay } from '@/lib/plannedExpenseDates';
import { invalidateFinance } from '@/lib/query';
import { isPremiumRequiredError } from '@/lib/errors';
import { enqueueJob, runOrQueue } from '@/lib/offline-queue';
import { useAuth } from '@/contexts/auth';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { OptionList } from '@/components/ui/option-list';
import { PlannedHelpSheet } from '@/components/ui/planned-help-sheet';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { color, radius, space, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

type Kind = 'expense' | 'income' | 'transfer';
type Line = { id: string; description: string; amount: string };

function newLine(): Line {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, description: '', amount: '' };
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export default function NewTransactionScreen() {
  const toast = useToast();
  const { isPremium, user } = useAuth();
  const { formatAmount } = useCurrency();
  const params = useLocalSearchParams<{ type?: string }>();
  const [kind, setKind] = useState<Kind>(
    params.type === 'income' ? 'income' : params.type === 'transfer' ? 'transfer' : 'expense'
  );
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [description, setDescription] = useState('');
  const todayUtc = getTodayUtcDateInputValue();
  const [date, setDate] = useState(todayUtc);
  const [walletId, setWalletId] = useState('');
  const [destId, setDestId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [toSavings, setToSavings] = useState(false);
  const [goalId, setGoalId] = useState('');
  const [pick, setPick] = useState<'wallet' | 'dest' | 'cat' | 'goal' | null>(null);
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hideHelp, setHideHelp] = useState(!!user?.hidePlannedExpensesHelp);

  const multiLine = kind !== 'transfer' && !toSavings;
  const selectedWallet = wallets.find((w) => w._id === walletId);
  const parsedLines = useMemo(
    () =>
      lines
        .map((line) => ({
          description: line.description.trim(),
          amount: parseFloat(line.amount.replace(',', '.')),
        }))
        .filter((line) => !Number.isNaN(line.amount) && line.amount > 0),
    [lines]
  );
  const totalAmount = parsedLines.reduce((sum, line) => sum + line.amount, 0);
  const exceeds =
    !toSavings &&
    (kind === 'expense' || kind === 'transfer') &&
    !!selectedWallet &&
    totalAmount > (selectedWallet.current_balance ?? 0);

  useEffect(() => {
    void (async () => {
      const w = await walletApi.getAll();
      setWallets(w);
      if (w[0] && !walletId) setWalletId(w[0]._id);
      if (kind !== 'transfer') {
        const c = await categoryApi.getAll(kind);
        setCategories(c);
      }
      if (isPremium && (kind === 'income' || kind === 'transfer')) {
        const g = await savingsGoalApi.getAll().catch(() => []);
        setGoals(g);
      } else setGoals([]);
    })();
  }, [kind, isPremium]);

  useEffect(() => {
    if (kind === 'expense') {
      setToSavings(false);
      setGoalId('');
    }
    if (kind !== 'expense' && isFutureUtcDay(date)) setDate(todayUtc);
  }, [kind, date, todayUtc]);

  const walletName = selectedWallet?.name ?? 'Choisir';
  const catName = categories.find((c) => c._id === categoryId)?.name ?? 'Sans catégorie';
  const destName = wallets.find((w) => w._id === destId)?.name ?? 'Destination';
  const goalName = goals.find((g) => g._id === goalId)?.title ?? 'Objectif';
  const futureExpense = kind === 'expense' && isFutureUtcDay(date);

  const chooseKind = (next: Kind) => {
    setKind(next);
    setLines([newLine()]);
    setToSavings(false);
    setGoalId('');
  };

  const submit = async () => {
    if (multiLine && parsedLines.length === 0) {
      toast('Ajoutez au moins un montant', 'err');
      return;
    }
    const n = multiLine ? totalAmount : parseFloat(lines[0]?.amount?.replace(',', '.') || '');
    if (!n || n <= 0) {
      toast('Montant requis', 'err');
      return;
    }
    if (toSavings && !goalId) {
      toast('Choisissez un objectif d’épargne', 'err');
      return;
    }
    if (!toSavings && !walletId) {
      toast('Montant et poche requis', 'err');
      return;
    }
    if (kind === 'transfer' && !destId) {
      toast('Choisissez la poche d’arrivée', 'err');
      return;
    }
    if (kind !== 'expense' && isFutureUtcDay(date)) {
      toast('Revenu et virement : date d’aujourd’hui au plus tard', 'err');
      return;
    }
    if (futureExpense && parsedLines.length > 1) {
      toast('Une dépense planifiée ne peut contenir qu’une seule ligne', 'err');
      return;
    }
    setLoading(true);
    try {
      const desc =
        description.trim() ||
        (parsedLines.length > 1 ? `${parsedLines.length} articles` : parsedLines[0]?.description || lines[0]?.description || '');
      const line_items =
        multiLine && parsedLines.length > 0
          ? sanitizeLineItems(
              parsedLines.map((line) => ({
                description: line.description || desc,
                amount: line.amount,
              }))
            )
          : undefined;
      const result = await runOrQueue(
        async () => {
          if (toSavings) {
            await transactionApi.createIncome({
              amount: n,
              description: desc,
              date,
              savings_goal_id: goalId,
            });
          } else if (kind === 'expense' && futureExpense) {
            await plannedExpenseApi.create({
              amount: n,
              wallet_id: walletId,
              category_id: categoryId || undefined,
              description: desc,
              scheduled_date: date,
            });
          } else if (kind === 'income') {
            await transactionApi.createIncome({
              amount: n,
              wallet_id: walletId,
              category_id: categoryId || undefined,
              description: desc,
              date,
              ...(line_items && line_items.length > 0 ? { line_items } : {}),
            });
          } else if (kind === 'expense') {
            await transactionApi.createExpense({
              amount: n,
              wallet_id: walletId,
              category_id: categoryId || undefined,
              description: desc,
              date,
              ...(line_items && line_items.length > 0 ? { line_items } : {}),
            });
          } else {
            await transactionApi.createTransfer({
              amount: n,
              wallet_id: walletId,
              destination_wallet_id: destId,
              description: desc,
              date,
            });
          }
        },
        async () => {
          if (toSavings || (kind === 'expense' && futureExpense)) {
            throw new Error('OFFLINE_UNSUPPORTED');
          }
          if (kind === 'income') {
            await enqueueJob({
              kind: 'tx-income',
              data: {
                amount: n,
                wallet_id: walletId,
                category_id: categoryId || undefined,
                description: desc,
                date,
                ...(line_items && line_items.length > 0 ? { line_items } : {}),
              },
            });
          } else if (kind === 'expense') {
            await enqueueJob({
              kind: 'tx-expense',
              data: {
                amount: n,
                wallet_id: walletId,
                category_id: categoryId || undefined,
                description: desc,
                date,
                ...(line_items && line_items.length > 0 ? { line_items } : {}),
              },
            });
          } else {
            await enqueueJob({
              kind: 'tx-transfer',
              data: {
                amount: n,
                wallet_id: walletId,
                destination_wallet_id: destId,
                description: desc,
                date,
              },
            });
          }
        }
      );
      if (!result.online) {
        toast('Enregistré hors ligne — synchro à la reconnexion', 'ok');
        await invalidateFinance();
        router.replace('/(tabs)/transactions');
        return;
      }
      if (toSavings) toast('Épargne alimentée', 'ok');
      else if (kind === 'expense' && futureExpense) toast('Dépense future enregistrée', 'ok');
      else if (kind === 'income') toast('Revenu ajouté', 'ok');
      else if (kind === 'expense') toast('Dépense ajoutée', 'ok');
      else toast('Virement effectué', 'ok');
      track('transaction_create', {
        screen: 'transactions_new',
        props: {
          element: toSavings ? 'savings' : kind === 'expense' && futureExpense ? 'planned' : kind,
        },
      });
      await invalidateFinance();
      router.replace('/(tabs)/transactions');
    } catch (err) {
      if (err instanceof Error && err.message === 'OFFLINE_UNSUPPORTED') {
        toast('Cette action nécessite une connexion', 'info');
        return;
      }
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
      } else toast(err instanceof Error ? err.message : 'Impossible', 'err');
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = futureExpense
    ? 'Planifier la dépense'
    : parsedLines.length > 1
      ? `Enregistrer (${parsedLines.length} lignes)`
      : 'Enregistrer';

  return (
    <Screen scroll>
      <ScreenHeader title="Nouvelle transaction" back />
      <View style={styles.kinds}>
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
            accessibilityRole="button"
            accessibilityState={{ selected: kind === k.key }}>
            <View style={styles.kindInner}>
              <Text style={[styles.kindT, kind === k.key && styles.kindTon]}>{k.label}</Text>
            </View>
          </PressScale>
        ))}
      </View>
      <Text style={styles.hint}>
        {toSavings
          ? 'L’épargne n’est liée à aucune poche.'
          : kind === 'income'
            ? 'Le solde de la poche augmente.'
            : kind === 'expense'
              ? 'Le solde de la poche diminue.'
              : 'L’argent passe d’une poche à une autre.'}
      </Text>

      <View style={{ gap: 16, marginTop: 8 }}>
        {selectedWallet && !toSavings && kind !== 'income' ? (
          <Text style={styles.balance}>Solde actuel : {formatAmount(selectedWallet.current_balance)}</Text>
        ) : null}

        {multiLine ? (
          <View style={{ gap: 10 }}>
            {kind === 'expense' || kind === 'income' ? (
              <Text style={styles.blockT}>{kind === 'expense' ? 'Dépenses' : 'Revenus'}</Text>
            ) : null}
            {lines.map((line, index) => (
              <View key={line.id} style={styles.line}>
                <View style={styles.lineRow}>
                  <Field
                    label="Libellé"
                    hideLabel={index > 0}
                    value={line.description}
                    onChangeText={(t) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, description: t } : l)))}
                    placeholder="Ex. Pain"
                    compact
                    containerStyle={styles.lineLabel}
                  />
                  <Field
                    label="Montant"
                    hideLabel={index > 0}
                    value={line.amount}
                    onChangeText={(t) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, amount: t } : l)))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    compact
                    containerStyle={styles.lineAmount}
                  />
                  {lines.length > 1 ? (
                    <PressScale
                      onPress={() => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== line.id)))}
                      style={styles.trash}
                      accessibilityLabel="Supprimer la ligne">
                      <Trash2 color={color.danger} size={18} />
                    </PressScale>
                  ) : null}
                </View>
              </View>
            ))}
            <PressScale onPress={() => setLines((prev) => [...prev, newLine()])} style={styles.addLine}>
              <Plus color={color.primary} size={16} />
              <Text style={styles.addLineT}>Ajouter une ligne</Text>
            </PressScale>
            {lines.length > 1 ? (
              <View style={styles.total}>
                <Text style={styles.totalK}>Total</Text>
                <Text style={[styles.totalV, exceeds && { color: color.danger }]}>{formatAmount(totalAmount || 0)}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Field
            label="Montant"
            value={lines[0]?.amount ?? ''}
            onChangeText={(t) => setLines([{ ...(lines[0] ?? newLine()), amount: t }])}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        )}
        {exceeds ? <Text style={styles.err}>Montant supérieur au solde de la poche</Text> : null}

        {isPremium && (kind === 'income' || kind === 'transfer') ? (
          <PressScale
            onPress={() => {
              if (!goals.length) {
                toast('Créez d’abord un objectif d’épargne', 'info');
                return;
              }
              setToSavings((v) => {
                const next = !v;
                if (!next) setGoalId('');
                else setLines([newLine()]);
                return next;
              });
            }}
            style={styles.toggle}>
            <View style={[styles.box, toSavings && styles.boxOn]} />
            <Text style={styles.toggleT}>Vers un objectif d’épargne</Text>
          </PressScale>
        ) : null}
        {toSavings ? (
          <PressScale onPress={() => setPick('goal')} style={styles.pick}>
            <Text style={styles.pickL}>Objectif</Text>
            <Text style={styles.pickV}>{goalName}</Text>
          </PressScale>
        ) : null}

        {!toSavings ? (
          <PressScale onPress={() => setPick('wallet')} style={styles.pick}>
            <View style={styles.pickRow}>
              <Text style={styles.pickL}>{kind === 'transfer' ? 'Depuis' : 'Poche'}</Text>
              <PressScale onPress={() => router.push('/wallets/new')}>
                <Text style={styles.addLink}>+ Ajouter</Text>
              </PressScale>
            </View>
            <Text style={styles.pickV}>{walletName}</Text>
          </PressScale>
        ) : null}
        {kind === 'transfer' && !toSavings ? (
          <PressScale onPress={() => setPick('dest')} style={styles.pick}>
            <Text style={styles.pickL}>Vers</Text>
            <Text style={styles.pickV}>{destName}</Text>
          </PressScale>
        ) : null}
        {kind !== 'transfer' && !toSavings ? (
          <PressScale onPress={() => setPick('cat')} style={styles.pick}>
            <View style={styles.pickRow}>
              <Text style={styles.pickL}>Catégorie (optionnel)</Text>
              <PressScale onPress={() => router.push('/categories')}>
                <Text style={styles.addLink}>+ Ajouter</Text>
              </PressScale>
            </View>
            <Text style={styles.pickV}>{catName}</Text>
          </PressScale>
        ) : null}

        {multiLine && lines.length > 1 ? (
          <Field
            label="Libellé de la transaction (optionnel)"
            value={description}
            onChangeText={setDescription}
            placeholder="Ex. Courses du marché"
          />
        ) : null}

        <DateField
          label="Date"
          value={date}
          onChange={(v) => {
            if (kind !== 'expense' && isFutureUtcDay(v)) {
              setDate(todayUtc);
              return;
            }
            setDate(v);
          }}
          maximumDate={kind !== 'expense' ? todayLocal() : undefined}
        />
        {kind === 'expense' && !hideHelp ? (
          <PressScale onPress={() => setHelpOpen(true)}>
            <Text style={styles.help}>Comment fonctionnent les dépenses prévues ?</Text>
          </PressScale>
        ) : null}

        <Button label={submitLabel} loadingLabel="Enregistrement…" onPress={() => void submit()} loading={loading} />
      </View>

      <Sheet open={pick !== null} onClose={() => setPick(null)} title="Choisir">
        {pick === 'wallet' ? (
          <OptionList options={wallets.map((w) => ({ value: w._id, label: w.name }))} value={walletId} onChange={(v) => { setWalletId(v); setPick(null); }} />
        ) : null}
        {pick === 'dest' ? (
          <OptionList options={wallets.filter((w) => w._id !== walletId).map((w) => ({ value: w._id, label: w.name }))} value={destId} onChange={(v) => { setDestId(v); setPick(null); }} />
        ) : null}
        {pick === 'cat' ? (
          <OptionList
            options={[{ value: '', label: 'Sans catégorie' }, ...categories.map((c) => ({ value: c._id, label: c.name }))]}
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setPick(null); }}
          />
        ) : null}
        {pick === 'goal' ? (
          <OptionList options={goals.map((g) => ({ value: g._id, label: g.title }))} value={goalId} onChange={(v) => { setGoalId(v); setPick(null); }} />
        ) : null}
      </Sheet>
      <PlannedHelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} onHidden={() => setHideHelp(true)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kinds: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 12,
  },
  kind: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  kindOn: { backgroundColor: color.primary },
  kindInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kindT: { fontFamily: font.sansMed, color: color.textSecondary, fontSize: 13 },
  kindTon: { color: color.white },
  hint: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginBottom: 8 },
  balance: { fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary },
  blockT: { fontFamily: font.sansMed, fontSize: 14, color: color.text },
  line: { backgroundColor: color.surface, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: color.border },
  lineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  lineLabel: { flex: 1.4, minWidth: 0 },
  lineAmount: { width: 108 },
  trash: { paddingBottom: 12, paddingHorizontal: 4 },
  addLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: color.border,
  },
  addLineT: { fontFamily: font.sansSemi, fontSize: 14, color: color.primary },
  total: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  totalK: { fontFamily: font.sans, color: color.textMuted },
  totalV: { fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  err: { fontFamily: font.sans, fontSize: 12, color: color.danger },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: color.border, backgroundColor: color.white },
  boxOn: { backgroundColor: color.primary, borderColor: color.primary },
  toggleT: { fontFamily: font.sans, fontSize: 14, color: color.text },
  pick: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[16],
    paddingVertical: 14,
    minHeight: 54,
    justifyContent: 'center',
  },
  pickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickL: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
  pickV: { fontFamily: font.sansMed, fontSize: 16, color: color.text, marginTop: 2 },
  addLink: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
  help: { fontFamily: font.sansMed, fontSize: 13, color: color.primary },
});
