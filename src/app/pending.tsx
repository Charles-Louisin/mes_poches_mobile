import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { pendingTransactionApi, walletApi, categoryApi, sanitizeLineItems, type PendingTransaction } from '@/lib/api';
import { defaultOpenDayKey, formatDateTime, groupTransactionsByDate, idOf, nameOf } from '@/lib/utils';
import { invalidateFinance } from '@/lib/query';
import { localPendings } from '@/lib/offline-queue';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Field } from '@/components/ui/field';
import { LineItems } from '@/components/ui/line-items';
import { OptionList } from '@/components/ui/option-list';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { PressScale } from '@/components/ui/press-scale';
import { BellArt } from '@/components/illustrations';
import { color, radius, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

function sourceLabel(s: string) {
  if (s === 'sms') return 'SMS';
  if (s === 'notification') return 'Notification';
  if (s === 'ai_scan') return 'Ticket';
  if (s === 'voice') return 'Note vocale';
  return 'Manuel';
}

function documentLabel(s?: string) {
  if (!s) return '';
  if (s === 'voice_note') return 'note vocale';
  if (s === 'handwritten_list') return 'écrit à la main';
  if (s === 'receipt') return 'ticket';
  return s.replace(/_/g, ' ');
}

function confidenceTone(c: number) {
  const pct = Math.round(Math.min(1, Math.max(0, c)) * 100);
  if (pct <= 50) return { fg: color.danger, bg: '#FDECEC' };
  if (pct <= 80) return { fg: '#B45309', bg: '#FFF7E8' };
  return { fg: color.success, bg: '#E8F8EF' };
}

type Draft = {
  amount: string;
  type: 'income' | 'expense';
  description: string;
  date: string;
  walletId: string;
  categoryId: string;
  items: NonNullable<PendingTransaction['ai_items']>;
};

function draftFrom(item: PendingTransaction): Draft {
  return {
    amount: String(item.amount),
    type: item.type,
    description: item.description || '',
    date: item.date?.slice(0, 10) || '',
    walletId: idOf(item.wallet_id),
    categoryId: idOf(item.category_id as { _id: string } | string | null),
    items: (item.ai_items ?? []).map((line) => ({ ...line })),
  };
}

export default function PendingScreen() {
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const qc = useQueryClient();
  const [pick, setPick] = useState<{ id: string; kind: 'wallet' | 'cat' } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [openReady, setOpenReady] = useState(false);
  const saving = useRef(false);

  const q = useQuery({
    queryKey: ['pending'],
    queryFn: async () => {
      const [remote, wallets, categories, local] = await Promise.all([
        pendingTransactionApi.getAll('pending').catch(() => [] as PendingTransaction[]),
        walletApi.getAll().catch(() => []),
        categoryApi.getAll().catch(() => []),
        localPendings(),
      ]);
      return { items: [...local, ...remote], wallets, categories };
    },
  });

  const groups = useMemo(
    () =>
      groupTransactionsByDate(
        (q.data?.items ?? []).map((item) => ({
          ...item,
          date: item.created_at || item.date,
        }))
      ),
    [q.data?.items]
  );

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

  const saveDraft = async (id: string, data: Draft) => {
    if (id.startsWith('local-')) {
      toast('Cette détection sera synchronisée à la reconnexion', 'info');
      return;
    }
    if (saving.current) return;
    saving.current = true;
    try {
      const n = parseFloat(data.amount.replace(',', '.'));
      await pendingTransactionApi.update(id, {
        amount: n > 0 ? n : undefined,
        type: data.type,
        description: data.description,
        date: data.date,
        wallet_id: data.walletId || undefined,
        category_id: data.categoryId || null,
        ai_items: data.items.length ? sanitizeLineItems(data.items) : undefined,
      });
      await q.refetch();
      toast('Modifications enregistrées', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
      throw err;
    } finally {
      saving.current = false;
    }
  };

  const startEdit = (item: PendingTransaction) => {
    setEditingId(item._id);
    setDraft(draftFrom(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (item: PendingTransaction) => {
    if (!draft) return;
    try {
      await saveDraft(item._id, draft);
      setEditingId(null);
      setDraft(null);
    } catch {
      /* toast déjà affiché */
    }
  };

  const act = async (item: PendingTransaction, kind: 'ok' | 'no') => {
    if (item._id.startsWith('local-')) {
      toast('Attendez la synchronisation hors ligne', 'info');
      return;
    }
    if (actingId) return;
    setActingId(item._id);
    try {
      if (kind === 'ok') {
        const d = editingId === item._id && draft ? draft : draftFrom(item);
        if (!d.walletId) {
          toast('Attribuez d’abord une poche', 'info');
          setPick({ id: item._id, kind: 'wallet' });
          return;
        }
        const n = parseFloat(d.amount.replace(',', '.'));
        await pendingTransactionApi.validate(item._id, {
          amount: n > 0 ? n : item.amount,
          type: d.type,
          wallet_id: d.walletId,
          category_id: d.categoryId || null,
          description: d.description,
          date: d.date,
          ai_items: d.items.length ? sanitizeLineItems(d.items) : undefined,
        });
      } else await pendingTransactionApi.reject(item._id);
      track(kind === 'ok' ? 'capture_validate' : 'capture_reject', {
        screen: 'pending',
        props: { source: item.source, element: kind === 'ok' ? 'validate' : 'reject' },
      });
      await invalidateFinance();
      await qc.invalidateQueries({ queryKey: ['pending'] });
      if (editingId === item._id) cancelEdit();
      toast(kind === 'ok' ? 'Transaction validée' : 'Ignoré', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    } finally {
      setActingId(null);
    }
  };

  const assign = async (value: string) => {
    if (!pick) return;
    try {
      if (editingId === pick.id && draft) {
        setDraft({
          ...draft,
          walletId: pick.kind === 'wallet' ? value : draft.walletId,
          categoryId: pick.kind === 'cat' ? value : draft.categoryId,
        });
      } else if (pick.id.startsWith('local-')) {
        toast('Choisissez la poche après synchronisation', 'info');
      } else {
        await pendingTransactionApi.update(
          pick.id,
          pick.kind === 'wallet' ? { wallet_id: value } : { category_id: value || null }
        );
        await q.refetch();
      }
      setPick(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    }
  };

  return (
    <Screen scroll onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <ScreenHeader title="À valider" back />
      <Text style={styles.lede}>Les détections SMS, tickets et dictées arrivent ici. Vous validez — ou vous ignorez.</Text>
      {q.isLoading && !q.data ? <PageSkeleton variant="pending" rows={3} /> : null}
      {groups.map((g) => {
        const dayOpen = openDays.has(g.dayKey);
        return (
          <View key={g.dayKey} style={styles.dayCard}>
            <PressScale onPress={() => toggleDay(g.dayKey)} style={styles.dayBtn} accessibilityRole="button">
              {dayOpen ? <ChevronUp color={color.primary} size={20} /> : <ChevronDown color={color.textMuted} size={20} />}
              <Text style={styles.day}>{g.label}</Text>
              <View style={styles.count}>
                <Text style={styles.countT}>{g.items.length}</Text>
              </View>
            </PressScale>
            {dayOpen
              ? g.items.map((item) => {
        const open = editingId === item._id && draft;
        const d = open ? draft : draftFrom(item);
        const low = item.low_confidence_warning || item.confidence < 0.75;
        const sign = d.type === 'income' ? '+' : '−';
        const n = parseFloat(d.amount.replace(',', '.'));
        const pct = Math.round((item.confidence || 0) * 100);
        const tone = confidenceTone(item.confidence || 0);
        const walletName =
          q.data?.wallets.find((w) => w._id === d.walletId)?.name ||
          nameOf(item.wallet_id as { name: string } | string, 'Poche');
        const catName =
          q.data?.categories.find((c) => c._id === d.categoryId)?.name ||
          nameOf(item.category_id as { name: string } | string, 'Catégorie');
        const doc = documentLabel(item.document_type);
        return (
          <View key={item._id} style={styles.card}>
            <View style={styles.srcRow}>
              <Text style={styles.src}>
                {sourceLabel(item.source)}
                {doc ? ` · ${doc}` : ''}
                {item._id.startsWith('local-') ? ' · hors ligne' : ''}
              </Text>
              <View style={[styles.confPill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.confT, { color: tone.fg }]}>confiance {pct} %</Text>
              </View>
            </View>
            <Text style={[styles.amt, { color: d.type === 'income' ? color.success : color.danger }]}>
              {sign}
              {formatAmount(Number.isNaN(n) ? item.amount : n)}
            </Text>
            <Text style={styles.desc}>{d.description || 'Sans libellé'}</Text>
            <Text style={styles.meta}>
              {d.type === 'income' ? 'Revenu' : 'Dépense'} · {formatDateTime(item.created_at || item.date)}
            </Text>
            {low ? (
              <Text style={styles.warn}>
                {item.low_confidence_warning || "Certaines informations n'ont pas pu être reconnues avec certitude."}
              </Text>
            ) : null}

            {open ? (
              <View style={{ gap: 12, marginTop: 12 }}>
                <View style={styles.kinds}>
                  <PressScale onPress={() => setDraft({ ...d, type: 'expense' })} style={[styles.kind, d.type === 'expense' && styles.kindOn]}>
                    <Text style={[styles.kindT, d.type === 'expense' && styles.kindTon]}>Dépense</Text>
                  </PressScale>
                  <PressScale onPress={() => setDraft({ ...d, type: 'income' })} style={[styles.kind, d.type === 'income' && styles.kindOn]}>
                    <Text style={[styles.kindT, d.type === 'income' && styles.kindTon]}>Revenu</Text>
                  </PressScale>
                </View>
                <Field
                  label={d.items.length > 1 ? 'Montant (somme des articles)' : 'Montant'}
                  value={d.amount}
                  onChangeText={(amount) => setDraft({ ...d, amount })}
                  keyboardType="decimal-pad"
                  editable={d.items.length <= 1}
                />
                <Field label="Libellé" value={d.description} onChangeText={(description) => setDraft({ ...d, description })} />
                <DateField label="Date" value={d.date} onChange={(date) => setDraft({ ...d, date })} />
              </View>
            ) : null}

            <View style={styles.picks}>
              <PressScale
                onPress={() => setPick({ id: item._id, kind: 'wallet' })}
                accessibilityRole="button"
                accessibilityLabel={`Poche : ${walletName}`}
                style={styles.pickBtn}>
                <Text style={styles.pickT} numberOfLines={1}>
                  {walletName}
                </Text>
                <ChevronDown color={color.primary} size={14} strokeWidth={2.2} />
              </PressScale>
              <PressScale
                onPress={() => setPick({ id: item._id, kind: 'cat' })}
                accessibilityRole="button"
                accessibilityLabel={`Catégorie : ${catName}`}
                style={styles.pickBtn}>
                <Text style={styles.pickT} numberOfLines={1}>
                  {catName}
                </Text>
                <ChevronDown color={color.primary} size={14} strokeWidth={2.2} />
              </PressScale>
            </View>

            {(open ? d.items : item.ai_items ?? []).length > 1 ? (
              <LineItems
                items={open ? d.items : item.ai_items}
                formatAmount={formatAmount}
                editable={!!open}
                onDescriptionChange={
                  open
                    ? (index, text) =>
                        setDraft({
                          ...d,
                          items: d.items.map((line, i) => (i === index ? { ...line, description: text } : line)),
                        })
                    : undefined
                }
                onAmountChange={
                  open
                    ? (index, text) => {
                        const parsed = parseFloat(text.replace(',', '.'));
                        const items = d.items.map((line, i) =>
                          i === index ? { ...line, amount: Number.isNaN(parsed) ? 0 : parsed } : line
                        );
                        const total = items.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
                        setDraft({ ...d, items, amount: String(total) });
                      }
                    : undefined
                }
              />
            ) : null}

            {open ? (
              <View style={styles.actions}>
                <Button label="Enregistrer" compact onPress={() => void saveEdit(item)} loading={actingId === item._id} />
                <Button label="Annuler" compact variant="line" onPress={cancelEdit} disabled={!!actingId} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button label="Modifier" compact variant="line" onPress={() => startEdit(item)} disabled={!!actingId} />
                <Button
                  label="Valider"
                  compact
                  loadingLabel="…"
                  onPress={() => void act(item, 'ok')}
                  loading={actingId === item._id}
                  disabled={!!actingId && actingId !== item._id}
                />
                <Button
                  label="Ignorer"
                  compact
                  variant="line"
                  loadingLabel="…"
                  onPress={() => void act(item, 'no')}
                  loading={actingId === item._id}
                  disabled={!!actingId && actingId !== item._id}
                />
              </View>
            )}
          </View>
        );
              })
              : null}
          </View>
        );
      })}
      {q.isSuccess && q.data.items.length === 0 ? (
        <EmptyState
          illustration={<BellArt size={200} />}
          title="Rien à valider"
          description="Les SMS, tickets scannés et dictées arriveront ici. Vous validez — ou vous ignorez."
        />
      ) : null}

      <Sheet open={pick !== null} onClose={() => setPick(null)} title={pick?.kind === 'wallet' ? 'Poche' : 'Catégorie'}>
        {pick?.kind === 'wallet' ? (
          <OptionList
            options={(q.data?.wallets ?? []).map((w) => ({ value: w._id, label: w.name }))}
            onChange={(v) => void assign(v)}
          />
        ) : (
          <OptionList
            options={[{ value: '', label: 'Sans catégorie' }, ...(q.data?.categories ?? []).map((c) => ({ value: c._id, label: c.name }))]}
            onChange={(v) => void assign(v)}
          />
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { fontFamily: font.sans, color: color.textSecondary, marginBottom: 22, lineHeight: 22 },
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
  card: {
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  srcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  src: { fontFamily: font.sansMed, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: color.primary, flex: 1 },
  confPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  confT: { fontFamily: font.sansSemi, fontSize: 11 },
  amt: { fontFamily: font.sansBold, fontSize: 28, marginTop: 6 },
  desc: { fontFamily: font.sansMed, color: color.text, marginTop: 8 },
  meta: { fontFamily: font.sans, color: color.textMuted, fontSize: 12, marginTop: 4 },
  warn: {
    marginTop: 10,
    fontFamily: font.sans,
    fontSize: 13,
    color: '#92400E',
    backgroundColor: '#FFF7E8',
    padding: 10,
    borderRadius: radius.md,
  },
  kinds: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.pill, padding: 4 },
  kind: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  kindOn: { backgroundColor: color.primary },
  kindT: { fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary },
  kindTon: { color: color.white },
  picks: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    backgroundColor: color.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  pickT: { fontFamily: font.sansSemi, color: color.primary, fontSize: 12, flex: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
