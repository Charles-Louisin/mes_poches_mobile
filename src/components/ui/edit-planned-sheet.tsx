import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { categoryApi, plannedExpenseApi, walletApi, type PlannedExpense } from '@/lib/api';
import { getMinFutureUtcDateInputValue } from '@/lib/plannedExpenseDates';
import { idOf } from '@/lib/utils';
import { useToast } from '@/contexts/toast';
import { Button } from './button';
import { DateField } from './date-field';
import { Field } from './field';
import { OptionList } from './option-list';
import { PressScale } from './press-scale';
import { Sheet } from './sheet';
import { Text } from 'react-native';
import { color, type as font } from '@/theme/tokens';

export function EditPlannedSheet({
  item,
  onClose,
  onSaved,
}: {
  item: PlannedExpense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const minDate = getMinFutureUtcDateInputValue();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(minDate);
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [wallets, setWallets] = useState<{ _id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [pick, setPick] = useState<'wallet' | 'cat' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setAmount(String(item.amount));
    setDescription(item.description || '');
    const d = item.scheduled_date.slice(0, 10);
    setDate(d < minDate ? minDate : d);
    setWalletId(idOf(item.wallet_id));
    setCategoryId(idOf(item.category_id as { _id: string } | string | null));
    void Promise.all([walletApi.getAll(), categoryApi.getAll('expense')]).then(([w, c]) => {
      setWallets(w);
      setCategories(c);
    });
  }, [item, minDate]);

  const walletName = wallets.find((w) => w._id === walletId)?.name ?? 'Poche';
  const catName = categories.find((c) => c._id === categoryId)?.name ?? 'Sans catégorie';

  const save = async () => {
    if (!item) return;
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || n <= 0 || !walletId) {
      toast('Montant et poche requis', 'err');
      return;
    }
    if (date < minDate) {
      toast('La date prévue doit être demain ou plus tard', 'err');
      return;
    }
    setSaving(true);
    try {
      await plannedExpenseApi.update(item._id, {
        amount: n,
        wallet_id: walletId,
        category_id: categoryId || null,
        description,
        scheduled_date: date,
      });
      toast('Échéance mise à jour', 'ok');
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={!!item && !pick} onClose={onClose} title="Modifier l’échéance">
        <View style={{ gap: 14 }}>
          <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Field label="Libellé" value={description} onChangeText={setDescription} />
          <DateField
            label="Date prévue"
            value={date}
            onChange={setDate}
            minimumDate={new Date(minDate + 'T00:00:00')}
          />
          <PressScale onPress={() => setPick('wallet')} style={{ paddingVertical: 8 }}>
            <Text style={{ fontFamily: font.sans, fontSize: 12, color: color.textMuted }}>Poche</Text>
            <Text style={{ fontFamily: font.sansMed, fontSize: 16, color: color.text }}>{walletName}</Text>
          </PressScale>
          <PressScale onPress={() => setPick('cat')} style={{ paddingVertical: 8 }}>
            <Text style={{ fontFamily: font.sans, fontSize: 12, color: color.textMuted }}>Catégorie</Text>
            <Text style={{ fontFamily: font.sansMed, fontSize: 16, color: color.text }}>{catName}</Text>
          </PressScale>
          <Button label="Enregistrer" loadingLabel="Enregistrement…" onPress={() => void save()} loading={saving} />
        </View>
      </Sheet>
      <Sheet open={pick !== null} onClose={() => setPick(null)} title="Choisir">
        {pick === 'wallet' ? (
          <OptionList
            options={wallets.map((w) => ({ value: w._id, label: w.name }))}
            value={walletId}
            onChange={(v) => {
              setWalletId(v);
              setPick(null);
            }}
          />
        ) : (
          <OptionList
            options={[{ value: '', label: 'Sans catégorie' }, ...categories.map((c) => ({ value: c._id, label: c.name }))]}
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setPick(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}
