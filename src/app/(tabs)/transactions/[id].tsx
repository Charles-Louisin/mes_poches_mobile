import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { categoryApi, sanitizeLineItems, transactionApi, walletApi, type TransactionLineItem } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';
import { formatDate, formatDateTime, getTransactionTypeLabel, idOf, nameOf, savingsGoalIdOf } from '@/lib/utils';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { LineItems } from '@/components/ui/line-items';
import { OptionList } from '@/components/ui/option-list';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { PressScale } from '@/components/ui/press-scale';
import { Amount } from '@/components/ui/amount';
import { TxExportRow } from '@/components/ui/tx-export-row';
import { color, type as font } from '@/theme/tokens';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
  const [pick, setPick] = useState<'wallet' | 'cat' | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const q = useQuery({
    queryKey: ['transaction', id],
    enabled: !!id,
    queryFn: async () => {
      const tx = await transactionApi.getById(id);
      const [wallets, categories, pair] = await Promise.all([
        walletApi.getAll(),
        categoryApi.getAll(tx.type === 'transfer' ? undefined : tx.type),
        tx.type === 'transfer' ? transactionApi.getTransferPair(id).catch(() => null) : Promise.resolve(null),
      ]);
      return { tx, wallets, categories, pair };
    },
  });

  const tx = q.data?.tx;

  useEffect(() => {
    if (!tx || editing) return;
    setDescription(tx.description || '');
    setAmount(String(tx.amount));
    setDate(tx.date.slice(0, 10));
    setWalletId(idOf(tx.wallet_id));
    setCategoryId(idOf(tx.category_id as { _id: string } | string | null));
    setLineItems((tx.line_items ?? []).map((line) => ({ ...line })));
  }, [editing, tx]);

  const walletName = q.data?.wallets.find((w) => w._id === walletId)?.name ?? nameOf(tx?.wallet_id as { name: string } | string);
  const catName = q.data?.categories.find((c) => c._id === categoryId)?.name ?? nameOf(tx?.category_id as { name: string } | string, 'Sans catégorie');

  const save = async () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || n <= 0) {
      toast('Montant invalide', 'err');
      return;
    }
    setSaving(true);
    try {
      await transactionApi.update(id, {
        description,
        amount: n,
        wallet_id: walletId || undefined,
        category_id: categoryId || null,
        date,
        ...(lineItems.length > 0 ? { line_items: sanitizeLineItems(lineItems) } : {}),
      });
      await invalidateFinance();
      await q.refetch();
      setEditing(false);
      toast('Écriture mise à jour', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Retirer cette écriture ?',
      body: 'Le solde de la poche sera recalculé.',
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await transactionApi.delete(id);
      await invalidateFinance();
      toast('Écriture retirée', 'ok');
      router.back();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    } finally {
      setRemoving(false);
    }
  };

  if (!tx) {
    return (
      <Screen>
        <ScreenHeader title="Fiche" back />
        <Text style={styles.meta}>{q.isLoading ? 'On ouvre le dossier…' : 'Écriture introuvable.'}</Text>
      </Screen>
    );
  }

  const signed =
    tx.type === 'expense' ? `−${formatAmount(tx.amount)}` : tx.type === 'income' ? `+${formatAmount(tx.amount)}` : formatAmount(tx.amount);

  return (
    <Screen scroll>
      <ScreenHeader title="Fiche" back />
      <Text style={styles.kicker}>{getTransactionTypeLabel(tx.type, savingsGoalIdOf(tx.savings_goal_id))}</Text>
      <Amount
        value={signed}
        size={48}
        color={tx.type === 'expense' ? color.ember : tx.type === 'income' ? color.moss : color.ivory}
      />
      <Text style={styles.when}>{formatDate(tx.date)}</Text>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.cellK}>Avant</Text>
          <Text style={styles.cellV}>{formatAmount(tx.balance_before)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellK}>Après</Text>
          <Text style={styles.cellV}>{formatAmount(tx.balance_after)}</Text>
        </View>
      </View>

      {q.data?.pair?.debit || q.data?.pair?.credit ? (
        <Text style={styles.pair}>
          Virement {nameOf(q.data.pair.debit?.wallet_id as { name: string } | string, 'source')} →{' '}
          {nameOf(q.data.pair.credit?.wallet_id as { name: string } | string, 'arrivée')}
        </Text>
      ) : null}

      {editing ? (
        <View style={{ gap: 18, marginTop: 20 }}>
          <Field label="Libellé" value={description} onChangeText={setDescription} />
          <Field
            label={lineItems.length > 1 ? 'Montant (somme des articles)' : 'Montant'}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            editable={lineItems.length <= 1}
          />
          <DateField label="Date" value={date} onChange={setDate} />
          <PressScale onPress={() => setPick('wallet')}>
            <Text style={styles.pickL}>Poche</Text>
            <Text style={styles.pickV}>{walletName}</Text>
          </PressScale>
          {tx.type !== 'transfer' ? (
            <PressScale onPress={() => setPick('cat')}>
              <Text style={styles.pickL}>Catégorie</Text>
              <Text style={styles.pickV}>{catName}</Text>
            </PressScale>
          ) : null}
          {lineItems.length > 1 ? (
            <LineItems
              items={lineItems}
              formatAmount={formatAmount}
              editable
              defaultOpen
              onDescriptionChange={(index, text) =>
                setLineItems((prev) => prev.map((line, i) => (i === index ? { ...line, description: text } : line)))
              }
              onAmountChange={(index, text) => {
                const n = parseFloat(text.replace(',', '.'));
                setLineItems((prev) => {
                  const next = prev.map((line, i) =>
                    i === index ? { ...line, amount: Number.isNaN(n) ? 0 : n, unit_amount: undefined, quantity: undefined } : line
                  );
                  const total = next.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
                  setAmount(String(total));
                  return next;
                });
              }}
            />
          ) : null}
          <Button label="Enregistrer" loadingLabel="Enregistrement…" onPress={() => void save()} loading={saving} />
          <Button label="Annuler" variant="ghost" onPress={() => setEditing(false)} />
        </View>
      ) : (
        <View style={{ marginTop: 22 }}>
          <Text style={styles.desc}>{tx.description || 'Sans libellé'}</Text>
          <Text style={styles.meta}>
            {nameOf(tx.wallet_id as { name: string } | string)} · {nameOf(tx.category_id as { name: string } | string, 'sans catégorie')}
          </Text>
          {(tx.line_items?.length ?? 0) > 1 ? (
            <LineItems items={tx.line_items} formatAmount={formatAmount} />
          ) : null}
          <Text style={styles.stamp}>Créée le {formatDateTime(tx.created_at)}</Text>
          {tx.updated_at || tx.updatedAt ? (
            <Text style={[styles.stamp, { color: color.primary }]}>
              Modifiée le {formatDateTime(tx.updated_at || tx.updatedAt || tx.created_at)}
            </Text>
          ) : null}
          <View style={{ height: 20 }} />
          <TxExportRow transactionId={tx._id} />
          <View style={{ height: 16 }} />
          <Button label="Corriger" variant="line" onPress={() => setEditing(true)} />
          <View style={{ height: 12 }} />
          <Button
            label="Supprimer"
            loadingLabel="Traitement…"
            variant="ember"
            onPress={() => void remove()}
            loading={removing}
          />
        </View>
      )}

      <Sheet open={pick !== null} onClose={() => setPick(null)} title="Choisir">
        {pick === 'wallet' ? (
          <OptionList
            options={(q.data?.wallets ?? []).map((w) => ({ value: w._id, label: w.name }))}
            value={walletId}
            onChange={(v) => {
              setWalletId(v);
              setPick(null);
            }}
          />
        ) : (
          <OptionList
            options={[
              { value: '', label: 'Sans catégorie' },
              ...(q.data?.categories ?? []).map((c) => ({ value: c._id, label: c.name })),
            ]}
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setPick(null);
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: font.sansMed,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: color.brass,
    marginBottom: 8,
  },
  when: { fontFamily: font.sans, color: color.mist, marginTop: 8 },
  grid: { flexDirection: 'row', gap: 18, marginTop: 22 },
  cell: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, paddingTop: 12 },
  cellK: { fontFamily: font.sansMed, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: color.brassMute },
  cellV: { fontFamily: font.display, fontSize: 22, color: color.ivory, marginTop: 6 },
  pair: { fontFamily: font.sans, color: color.brass, marginTop: 16 },
  desc: { fontFamily: font.sansMed, fontSize: 17, color: color.ivory },
  meta: { fontFamily: font.sans, color: color.brassMute, marginTop: 6 },
  stamp: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, marginTop: 10 },
  pickL: { fontFamily: font.sansMed, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: color.brassMute },
  pickV: {
    fontFamily: font.sans,
    fontSize: 17,
    color: color.ivory,
    marginTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.lineStrong,
  },
});
