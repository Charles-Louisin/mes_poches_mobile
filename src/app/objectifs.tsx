import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
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
import { OptionList } from '@/components/ui/option-list';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { PressScale } from '@/components/ui/press-scale';
import { ChartArt, CoinsArt, GiftArt } from '@/components/illustrations';
import { color, type as font } from '@/theme/tokens';
import { formatDate, nameOf } from '@/lib/utils';

export default function ObjectifsScreen() {
  const { isPremium, requirePremium } = useAuth();
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [form, setForm] = useState<'budget' | 'goal' | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pickCat, setPickCat] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const removeBudget = async (id: string) => {
    const ok = await confirm({
      title: 'Retirer ce plafond ?',
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    await budgetApi.delete(id);
    await invalidateFinance();
    void q.refetch();
  };

  const removeGoal = async (id: string) => {
    const ok = await confirm({
      title: 'Retirer cette cible ?',
      body: 'L’épargne déjà versée reste dans vos poches.',
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    await savingsGoalApi.delete(id);
    await invalidateFinance();
    void q.refetch();
  };

  const submit = async () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || n <= 0) {
      toast('Montant requis', 'err');
      return;
    }
    setSaving(true);
    try {
      if (form === 'budget') {
        if (!categoryId) {
          toast('Choisissez un rayon', 'err');
          setSaving(false);
          return;
        }
        await budgetApi.create({ category_id: categoryId, year, month, limit_amount: n });
        toast('Plafond posé', 'ok');
      } else {
        if (!title.trim()) {
          toast('Un titre, d’abord', 'err');
          setSaving(false);
          return;
        }
        await savingsGoalApi.create({
          title: title.trim(),
          target_amount: n,
          deadline: deadline.trim() || null,
        });
        toast('Cible ouverte', 'ok');
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
      } else toast(getErrorMessage(err, 'Impossible'), 'err');
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
          title="Objectifs Premium"
          description="Budgets, cibles d’épargne et récurrences : disponibles avec Premium."
          cta="Voir Premium"
          onPress={() => requirePremium()}
        />
      </Screen>
    );
  }

  const catName = q.data?.categories.find((c) => c._id === categoryId)?.name ?? 'Choisir un rayon';

  return (
    <Screen scroll onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <ScreenHeader title="Objectifs" back />
      <Text style={styles.sec}>Budgets du mois</Text>
      {q.isLoading && !q.data ? <PageSkeleton variant="goals" rows={3} /> : null}
      {(q.data?.budgets ?? []).map((b) => {
        const pct = b.percent ?? ((b.spent ?? 0) / Math.max(1, b.limit_amount)) * 100;
        return (
          <PressScale
            key={b._id}
            onLongPress={() => void removeBudget(b._id)}
            style={styles.block}>
            <View style={styles.row}>
              <Text style={styles.name}>{nameOf(b.category_id as { name: string } | string)}</Text>
              <Text style={styles.amt}>
                {formatAmount(b.spent ?? 0)} / {formatAmount(b.limit_amount)}
              </Text>
            </View>
                <InkBar value={pct} tone={pct >= 100 ? 'ember' : 'brass'} />
                {pct >= 100 ? <Text style={styles.over}>Budget dépassé</Text> : null}
          </PressScale>
        );
      })}
      {q.isSuccess && (q.data.budgets ?? []).length === 0 ? (
        <EmptyState
          illustration={<ChartArt size={160} />}
          title="Aucun budget ce mois"
          description="Posez un plafond par catégorie pour suivre vos sorties."
        />
      ) : null}
      <View style={{ marginBottom: 8 }}>
        <Button label="Poser un plafond" onPress={() => setForm('budget')} />
      </View>

      <Text style={styles.sec}>Cibles d’épargne</Text>
      {(q.data?.goals ?? []).map((g) => {
        const current = g.current_amount ?? g.saved_amount ?? 0;
        const pct = g.progress_percent ?? (current / Math.max(1, g.target_amount)) * 100;
        return (
          <PressScale
            key={g._id}
            onLongPress={() => void removeGoal(g._id)}
            style={styles.block}>
            <View style={styles.row}>
              <Text style={styles.name}>{g.title}</Text>
              <Text style={styles.amt}>
                {formatAmount(current)} / {formatAmount(g.target_amount)}
              </Text>
            </View>
            <InkBar value={pct} tone="moss" />
            {g.deadline ? <Text style={styles.limit}>Limite : {formatDate(g.deadline)}</Text> : null}
          </PressScale>
        );
      })}
      {q.isSuccess && (q.data.goals ?? []).length === 0 ? (
        <EmptyState
          illustration={<CoinsArt size={160} />}
          title="Aucune cible d’épargne"
          description="Ouvrez une cible pour mettre de côté, mois après mois."
        />
      ) : null}
      <View style={{ marginBottom: 8 }}>
        <Button label="Ouvrir une cible" onPress={() => setForm('goal')} />
      </View>

      <Text style={styles.sec}>Récurrences</Text>
      <Text style={styles.recHint}>
        L’IA repère les mouvements répétitifs et les propose ici. Rien n’est joué tant que vous n’avez pas validé.
      </Text>
      {(q.data?.active ?? []).map((r) => (
        <View key={r._id} style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.name}>{r.description || 'Mouvement'}</Text>
            <Text style={styles.next}>Prochaine : {formatDate(r.next_run_date)}</Text>
          </View>
          <PressScale
            onPress={async () => {
              try {
                await recurringApi.run(r._id);
                toast('Transaction créée', 'ok');
                void q.refetch();
                await invalidateFinance();
              } catch (e) {
                toast(getErrorMessage(e, 'Impossible'), 'err');
              }
            }}>
            <Text style={styles.link}>jouer</Text>
          </PressScale>
        </View>
      ))}
      {(q.data?.suggested ?? []).length > 0 ? (
        <Text style={styles.suggest}>Suggestions IA à valider</Text>
      ) : null}
      {(q.data?.suggested ?? []).map((r) => (
        <View key={r._id} style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.name}>{r.description || 'Suggestion'}</Text>
            <Text style={styles.next}>
              {r.frequency === 'weekly' ? 'Chaque semaine' : 'Chaque mois'} · {formatAmount(r.amount)}
            </Text>
          </View>
          <PressScale
            onPress={async () => {
              await recurringApi.accept(r._id);
              void q.refetch();
            }}>
            <Text style={styles.link}>retenir</Text>
          </PressScale>
          <PressScale
            onPress={async () => {
              await recurringApi.dismiss(r._id);
              void q.refetch();
            }}
            style={{ marginLeft: 12 }}>
            <Text style={styles.dismiss}>ignorer</Text>
          </PressScale>
        </View>
      ))}

      <Sheet open={form !== null} onClose={() => setForm(null)} title={form === 'budget' ? 'Plafond' : 'Cible'}>
        {form === 'budget' ? (
          <PressScale onPress={() => setPickCat(true)} style={{ marginBottom: 16 }}>
            <Text style={styles.pickL}>Rayon</Text>
            <Text style={styles.pickV}>{catName}</Text>
          </PressScale>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <Field label="Titre" value={title} onChangeText={setTitle} />
            <View style={{ height: 12 }} />
            <DateField
              label="Date limite (optionnel)"
              value={deadline || getTodayUtcDateInputValue()}
              onChange={setDeadline}
            />
          </View>
        )}
        <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <View style={{ height: 16 }} />
        <Button label="Enregistrer" loadingLabel="Enregistrement…" onPress={() => void submit()} loading={saving} />
      </Sheet>
      <Sheet open={pickCat} onClose={() => setPickCat(false)} title="Rayon">
        <OptionList
          options={(q.data?.categories ?? []).map((c) => ({ value: c._id, label: c.name }))}
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
  gate: { fontFamily: font.displayItalic, fontSize: 26, color: color.ivory, lineHeight: 32 },
  sec: { marginTop: 24, marginBottom: 8, fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  block: { marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  name: { fontFamily: font.sans, color: color.ivory, flex: 1, paddingRight: 12 },
  amt: { fontFamily: font.display, fontSize: 18, color: color.ivory },
  over: { fontFamily: font.sansMed, color: color.ember, fontSize: 12, marginTop: 6 },
  limit: { fontFamily: font.sans, color: color.brassMute, fontSize: 12, marginTop: 6 },
  next: { fontFamily: font.sans, color: color.brassMute, fontSize: 12, marginTop: 2 },
  suggest: { fontFamily: font.sansMed, color: '#B45309', fontSize: 12, marginTop: 8, marginBottom: 4 },
  recHint: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, lineHeight: 19, marginBottom: 8 },
  dismiss: { fontFamily: font.sansMed, color: color.ember, fontSize: 13 },
  empty: { fontFamily: font.sans, color: color.brassMute },
  link: { fontFamily: font.sansMed, color: color.brass },
  add: { paddingVertical: 10, marginBottom: 4 },
  addT: { fontFamily: font.sansMed, color: color.brass, fontSize: 13 },
  pickL: { fontFamily: font.sansMed, fontSize: 13, color: color.brassMute },
  pickV: { fontFamily: font.sans, fontSize: 17, color: color.ivory, marginTop: 6, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineStrong },
});
