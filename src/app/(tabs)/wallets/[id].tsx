import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { plannedExpenseApi, walletApi, type PlannedExpense } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { defaultOpenDayKey, groupTransactionsByDate } from '@/lib/utils';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { EditPlannedSheet } from '@/components/ui/edit-planned-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Field } from '@/components/ui/field';
import { ImageUpload } from '@/components/ui/image-upload';
import { Passbook } from '@/components/ui/passbook';
import { PlannedItem } from '@/components/ui/planned-item';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TransactionItem } from '@/components/ui/transaction-item';
import { PressScale } from '@/components/ui/press-scale';
import { ReceiptArt } from '@/components/illustrations';
import { color, radius, type as font } from '@/theme/tokens';

export default function WalletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlannedExpense | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [openReady, setOpenReady] = useState(false);

  const q = useQuery({
    queryKey: ['wallet', id],
    enabled: !!id,
    queryFn: () => walletApi.getHistory(id),
  });

  const wallet = q.data?.wallet;
  const groups = groupTransactionsByDate(q.data?.transactions ?? []);

  useEffect(() => {
    setOpenReady(false);
  }, [id]);

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

  const startEdit = () => {
    if (wallet) {
      setName(wallet.name);
      setImageUrl(wallet.image_url ?? null);
    }
    setEditing(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await walletApi.update(id, { name: name.trim(), image_url: imageUrl });
      await invalidateFinance();
      await q.refetch();
      setEditing(false);
      toast('Poche mise à jour', 'ok');
    } catch (err) {
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
        return;
      }
      toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if ((q.data?.transactions ?? []).length > 0) {
      toast('Impossible de supprimer une poche avec des transactions', 'err');
      return;
    }
    const ok = await confirm({
      title: 'Fermer cette poche ?',
      confirmLabel: 'Fermer',
      danger: true,
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await walletApi.delete(id);
      await invalidateFinance();
      toast('Poche fermée', 'ok');
      router.replace('/(tabs)/wallets');
    } catch (err) {
      toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setRemoving(false);
    }
  };

  const cancelPlan = async (planId: string) => {
    const ok = await confirm({
      title: 'Annuler cette échéance ?',
      confirmLabel: 'Annuler l’échéance',
      cancelLabel: 'Garder',
      danger: true,
    });
    if (!ok) return;
    try {
      setCancellingId(planId);
      await plannedExpenseApi.cancel(planId);
      await invalidateFinance();
      await q.refetch();
      toast('Échéance retirée', 'ok');
    } catch (err) {
      toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setCancellingId(null);
    }
  };

  if (!wallet) {
    return (
      <Screen>
        <ScreenHeader title="Poche" back />
        {q.isLoading ? <PageSkeleton variant="cards" rows={2} /> : <Text style={styles.meta}>Poche introuvable.</Text>}
      </Screen>
    );
  }

  return (
    <Screen scroll onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <ScreenHeader title={editing ? 'Modifier' : wallet.name} back />

      {wallet.image_url && !editing ? (
        <View style={styles.hero}>
          <Image source={{ uri: wallet.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.heroWash} />
          <Text style={styles.heroK}>Solde actuel</Text>
          <Text style={styles.heroAmt}>{formatAmount(wallet.current_balance)}</Text>
        </View>
      ) : (
        <Passbook
          name={wallet.name}
          amount={formatAmount(wallet.current_balance)}
          monthIncome={wallet.month_income ?? 0}
          monthExpense={wallet.month_expense ?? 0}
          formatAmount={formatAmount}
          imageUrl={wallet.image_url}
        />
      )}

      {editing ? (
        <View style={{ gap: 16, marginTop: 8, marginBottom: 24 }}>
          <ImageUpload value={imageUrl} onChange={setImageUrl} endpoint="walletImage" label="Icône" />
          <Field label="Nom" value={name} onChangeText={setName} />
          <Button label="Enregistrer" loadingLabel="Enregistrement…" onPress={() => void save()} loading={saving} />
          <Button label="Annuler" variant="ghost" onPress={() => setEditing(false)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Button label="Modifier" variant="line" onPress={startEdit} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Fermer" loadingLabel="Traitement…" variant="ember" onPress={() => void remove()} loading={removing} />
          </View>
        </View>
      )}

      {(q.data?.planned_expenses ?? []).length > 0 ? (
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.sec}>Transactions futures</Text>
          {q.data!.planned_expenses!.map((p) => (
            <PlannedItem
              key={p._id}
              item={p}
              formatAmount={formatAmount}
              cancelling={cancellingId === p._id}
              walletBalance={wallet.current_balance}
              onEdit={() => setEditingPlan(p)}
              onCancel={() => void cancelPlan(p._id)}
              onSettled={() => void q.refetch()}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.sec}>Mouvements</Text>
      {groups.map((g) => {
        const isOpen = openDays.has(g.dayKey);
        return (
          <View key={g.dayKey} style={styles.dayCard}>
            <PressScale onPress={() => toggleDay(g.dayKey)} style={styles.dayBtn} accessibilityRole="button">
              {isOpen ? <ChevronUp color={color.primary} size={20} /> : <ChevronDown color={color.textMuted} size={20} />}
              <Text style={styles.day}>{g.label}</Text>
              <View style={styles.count}>
                <Text style={styles.countT}>{g.items.length}</Text>
              </View>
            </PressScale>
            {isOpen
              ? g.items.map((t) => (
                  <TransactionItem
                    key={t._id}
                    tx={t}
                    formatAmount={formatAmount}
                    onPress={() => router.push(`/transactions/${t._id}`)}
                  />
                ))
              : null}
          </View>
        );
      })}
      {(q.data?.transactions ?? []).length === 0 ? (
        <EmptyState
          illustration={<ReceiptArt size={180} />}
          title="Pas encore de mouvement"
          description="Les dépenses et revenus de cette poche apparaîtront ici."
          cta="Ajouter"
          onPress={() => router.push('/transactions/new')}
        />
      ) : null}

      <EditPlannedSheet
        item={editingPlan}
        onClose={() => setEditingPlan(null)}
        onSaved={() => {
          void invalidateFinance();
          void q.refetch();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 200,
    borderRadius: radius.largeCard,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 20,
    marginBottom: 8,
  },
  heroWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(29,78,216,0.72)',
  },
  heroK: { fontFamily: font.sans, fontSize: 13, color: 'rgba(255,255,255,0.8)', zIndex: 1 },
  heroAmt: { fontFamily: font.sansBold, fontSize: 32, color: color.white, zIndex: 1, marginTop: 4 },
  sec: {
    fontFamily: font.sansSemi,
    fontSize: 16,
    color: color.text,
    marginBottom: 10,
  },
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
  countT: { fontFamily: font.sansMed, fontSize: 12, color: color.textSecondary },
  meta: { fontFamily: font.sans, color: color.textMuted },
});
