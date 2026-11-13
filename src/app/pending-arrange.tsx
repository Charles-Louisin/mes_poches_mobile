import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react-native';
import {
  categoryApi,
  lineCategoryId,
  pendingTransactionApi,
  sanitizeLineItems,
  transactionApi,
  walletApi,
  type Category,
  type PendingTransaction,
  type Wallet,
} from '@/lib/api';
import { categoryOption, walletOption } from '@/lib/plan-options';
import { idOf } from '@/lib/utils';
import { invalidateFinance } from '@/lib/query';
import { getErrorMessage } from '@/lib/errors';
import { useCurrency } from '@/contexts/currency';
import { useConfirm } from '@/contexts/confirm';
import { useToast } from '@/contexts/toast';
import { InfoSheet, type InfoContent } from '@/components/ui/info-sheet';
import { OptionList } from '@/components/ui/option-list';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { color, radius, shadow, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

/**
 * Atelier de tri des propositions de l'IA (ticket, note vocale, notifications) :
 * déplacer une ligne d'une fiche à l'autre (ou vers une nouvelle fiche), réordonner, reclasser,
 * corriger — tout est recalculé en direct, puis validé d'un coup.
 */

type Kind = 'income' | 'expense';
type Line = { id: string; description: string; amount: string; categoryId: string };
type Fiche = {
  id: string;
  /** null : fiche créée dans l'atelier (enregistrée comme nouvelle transaction). */
  pendingId: string | null;
  source: string;
  type: Kind;
  walletId: string;
  categoryId: string;
  date: string;
  lines: Line[];
  /** Mise de côté : reste « à valider », non touchée par la validation groupée. */
  later: boolean;
};

type Pick =
  | { kind: 'wallet'; ficheId: string }
  | { kind: 'cat'; ficheId: string }
  | { kind: 'lineCat'; ficheId: string; lineId: string }
  | { kind: 'move'; ficheId: string; lineId: string };

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const parseAmount = (raw: string) => parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const layout = LinearTransition.duration(220).easing(EASE_OUT);
const today = () => new Date().toISOString().slice(0, 10);

const INFO: InfoContent = {
  title: 'Trier avant de valider',
  what: 'L’IA a préparé des fiches. Réorganisez-les comme vous voulez : rien n’est enregistré avant « Tout valider ».',
  how: [
    '« Déplacer » envoie une ligne dans une autre fiche, ou dans une nouvelle fiche.',
    'Les flèches changent l’ordre des lignes ; le libellé et le montant se corrigent directement.',
    'Chaque fiche a sa poche, sa catégorie et son type ; chaque ligne peut avoir sa propre catégorie.',
    'Les totaux et les soldes sont recalculés à chaque changement.',
    '« Plus tard » laisse une fiche dans « À valider » ; une fiche vidée de ses lignes est ignorée.',
  ],
};

function sourceLabel(s: string) {
  if (s === 'ai_scan') return 'Photo';
  if (s === 'voice') return 'Note vocale';
  if (s === 'sms' || s === 'notification') return 'Mobile Money';
  if (s === 'atelier') return 'Nouvelle fiche';
  return 'Proposition';
}

function ficheFrom(p: PendingTransaction): Fiche {
  const items = p.ai_items ?? [];
  const lines: Line[] = items.length
    ? items.map((l) => ({ id: uid(), description: l.description || '', amount: String(l.amount ?? ''), categoryId: lineCategoryId(l) }))
    : [{ id: uid(), description: p.description || '', amount: String(p.amount ?? ''), categoryId: '' }];
  return {
    id: uid(),
    pendingId: p._id,
    source: p.source,
    type: p.type,
    walletId: idOf(p.wallet_id as { _id: string } | string | null),
    categoryId: idOf(p.category_id as { _id: string } | string | null),
    date: p.date?.slice(0, 10) || today(),
    lines,
    later: false,
  };
}

function validLines(f: Fiche) {
  return f.lines
    .map((l) => ({ ...l, value: parseAmount(l.amount) }))
    .filter((l) => Number.isFinite(l.value) && l.value > 0);
}
const total = (f: Fiche) => validLines(f).reduce((s, l) => s + l.value, 0);

export default function PendingArrangeScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { formatAmount } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [pick, setPick] = useState<Pick | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  /** Fiches repliées (une ligne de résumé) : rien n’est perdu, un toucher les rouvre. */
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const toggleFold = (id: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearFiche = async (f: Fiche, index: number) => {
    const ok = await confirm({
      title: `Tout supprimer dans la fiche ${index + 1} ?`,
      body: 'Ses lignes sont retirées. À la validation, cette proposition sera ignorée.',
      confirmLabel: 'Tout supprimer',
      danger: true,
    });
    if (ok) patchFiche(f.id, { lines: [] });
  };
  const loaded = useRef(false);

  const q = useQuery({
    queryKey: ['pending-arrange', ids ?? 'all'],
    queryFn: async () => {
      const [items, wallets, inc, exp] = await Promise.all([
        pendingTransactionApi.getAll('pending'),
        walletApi.getAll().catch(() => [] as Wallet[]),
        categoryApi.getAll('income').catch(() => [] as Category[]),
        categoryApi.getAll('expense').catch(() => [] as Category[]),
      ]);
      const wanted = ids ? new Set(ids.split(',')) : null;
      return {
        items: wanted ? items.filter((i) => wanted.has(i._id)) : items,
        wallets,
        categories: [...inc, ...exp],
      };
    },
  });

  useEffect(() => {
    if (!q.data || loaded.current) return;
    loaded.current = true;
    const initial = q.data.items.map(ficheFrom);
    setFiches(initial);
    // Beaucoup de fiches : seule la première est dépliée, les autres prennent une ligne chacune.
    if (initial.length >= 3) setFolded(new Set(initial.slice(1).map((f) => f.id)));
  }, [q.data]);

  const wallets = q.data?.wallets ?? [];
  const categories = q.data?.categories ?? [];
  const walletOf = (id: string) => wallets.find((w) => w._id === id);
  const catName = (id: string) => categories.find((c) => c._id === id)?.name;
  const catsFor = (type: Kind) => categories.filter((c) => c.type === type);

  const patchFiche = (id: string, patch: Partial<Fiche>) =>
    setFiches((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const patchLine = (ficheId: string, lineId: string, patch: Partial<Line>) =>
    setFiches((prev) =>
      prev.map((f) => (f.id === ficheId ? { ...f, lines: f.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) } : f))
    );
  const moveWithin = (ficheId: string, lineId: string, dir: -1 | 1) =>
    setFiches((prev) =>
      prev.map((f) => {
        if (f.id !== ficheId) return f;
        const i = f.lines.findIndex((l) => l.id === lineId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= f.lines.length) return f;
        const lines = [...f.lines];
        [lines[i], lines[j]] = [lines[j], lines[i]];
        return { ...f, lines };
      })
    );
  const removeLine = (ficheId: string, lineId: string) =>
    setFiches((prev) => prev.map((f) => (f.id === ficheId ? { ...f, lines: f.lines.filter((l) => l.id !== lineId) } : f)));
  const addLine = (ficheId: string) =>
    setFiches((prev) =>
      prev.map((f) => (f.id === ficheId ? { ...f, lines: [...f.lines, { id: uid(), description: '', amount: '', categoryId: '' }] } : f))
    );

  /** Déplace une ligne vers une autre fiche (ou une nouvelle). La catégorie suit si elle est du bon sens. */
  const moveLine = (fromId: string, lineId: string, toId: string | 'new') => {
    setFiches((prev) => {
      const from = prev.find((f) => f.id === fromId);
      const line = from?.lines.find((l) => l.id === lineId);
      if (!from || !line) return prev;
      const next = prev.map((f) => (f.id === fromId ? { ...f, lines: f.lines.filter((l) => l.id !== lineId) } : f));
      if (toId === 'new') {
        const created: Fiche = {
          id: uid(),
          pendingId: null,
          source: 'atelier',
          type: from.type,
          walletId: from.walletId,
          categoryId: line.categoryId || from.categoryId,
          date: from.date,
          lines: [{ ...line, categoryId: line.categoryId }],
          later: false,
        };
        const at = next.findIndex((f) => f.id === fromId);
        next.splice(at + 1, 0, created);
        return next;
      }
      return next.map((f) => {
        if (f.id !== toId) return f;
        const cat = categories.find((c) => c._id === line.categoryId);
        const keepCat = !cat || cat.type === f.type;
        return { ...f, lines: [...f.lines, { ...line, categoryId: keepCat ? line.categoryId : '' }] };
      });
    });
    toast(toId === 'new' ? 'Ligne déplacée dans une nouvelle fiche' : 'Ligne déplacée', 'ok');
  };

  const setType = (f: Fiche, type: Kind) => {
    if (f.type === type) return;
    // Les catégories dépendent du sens : on les retire si elles ne correspondent plus.
    const ok = (id: string) => !id || categories.find((c) => c._id === id)?.type === type;
    patchFiche(f.id, {
      type,
      categoryId: ok(f.categoryId) ? f.categoryId : '',
      lines: f.lines.map((l) => ({ ...l, categoryId: ok(l.categoryId) ? l.categoryId : '' })),
    });
  };

  const active = fiches.filter((f) => !f.later);
  const toSave = active.filter((f) => validLines(f).length > 0);
  const emptied = active.filter((f) => validLines(f).length === 0 && f.pendingId);

  /** Solde dépassé, cumulé par poche sur toutes les fiches de dépense. */
  const overdrawn = useMemo(() => {
    const per = new Map<string, number>();
    for (const f of toSave) if (f.type === 'expense') per.set(f.walletId, (per.get(f.walletId) ?? 0) + total(f));
    const out = new Set<string>();
    for (const f of toSave) {
      const w = wallets.find((x) => x._id === f.walletId);
      if (f.type === 'expense' && w && (per.get(f.walletId) ?? 0) > w.current_balance) out.add(f.id);
    }
    return out;
  }, [toSave, wallets]);

  const sumExpense = toSave.filter((f) => f.type === 'expense').reduce((s, f) => s + total(f), 0);
  const sumIncome = toSave.filter((f) => f.type === 'income').reduce((s, f) => s + total(f), 0);

  const validateAll = async () => {
    if (!toSave.length && !emptied.length) return toast('Rien à valider', 'info');
    const missing = toSave.find((f) => !f.walletId);
    if (missing) {
      setPick({ kind: 'wallet', ficheId: missing.id });
      return toast('Choisissez une poche pour chaque fiche', 'err');
    }
    if (toSave.some((f) => overdrawn.has(f.id))) return toast('Une poche n’a pas un solde suffisant', 'err');
    if (emptied.length) {
      const ok = await confirm({
        title: `${emptied.length} fiche${emptied.length > 1 ? 's' : ''} vide${emptied.length > 1 ? 's' : ''}`,
        body: 'Elles n’ont plus de ligne : elles seront ignorées.',
        confirmLabel: 'Continuer',
      });
      if (!ok) return;
    }
    const steps = toSave.filter((f) => f.pendingId).length + emptied.length + (toSave.some((f) => !f.pendingId) ? 1 : 0);
    let done = 0;
    let failed = 0;
    setProgress({ done, total: steps });
    const step = () => setProgress({ done: ++done, total: steps });
    const payloadFor = (f: Fiche) => {
      const lines = validLines(f);
      return {
        description: lines.length > 1 ? `${lines.length} articles` : lines[0].description.trim(),
        lines: sanitizeLineItems(
          lines.map((l) => ({ description: l.description.trim(), amount: l.value, type: f.type, category_id: l.categoryId || f.categoryId || null }))
        ),
      };
    };
    // 1. Propositions existantes : validées avec leurs nouvelles lignes (le montant suit les lignes).
    for (const f of toSave.filter((x) => x.pendingId)) {
      const p = payloadFor(f);
      try {
        await pendingTransactionApi.validate(f.pendingId!, {
          amount: total(f),
          type: f.type,
          wallet_id: f.walletId,
          category_id: f.categoryId || null,
          description: p.description,
          date: f.date,
          ai_items: p.lines,
        });
      } catch {
        failed++;
      }
      step();
    }
    // 2. Fiches créées dans l'atelier : un seul lot.
    const fresh = toSave.filter((x) => !x.pendingId);
    if (fresh.length) {
      try {
        const res = await transactionApi.createBatch(
          fresh.map((f) => {
            const p = payloadFor(f);
            return {
              kind: f.type,
              wallet_id: f.walletId,
              category_id: f.categoryId || null,
              description: p.description,
              date: f.date === today() ? undefined : f.date,
              line_items: p.lines,
            };
          })
        );
        failed += res.failed;
      } catch {
        failed += fresh.length;
      }
      step();
    }
    // 3. Propositions vidées : ignorées.
    for (const f of emptied) {
      await pendingTransactionApi.reject(f.pendingId!).catch(() => {
        failed++;
      });
      step();
    }
    track('capture_validate', { screen: 'pending_arrange', props: { element: `arrange-${toSave.length}` } });
    void invalidateFinance();
    setProgress(null);
    if (failed) toast(`${failed} élément(s) non enregistré(s). Les autres sont validés.`, 'err');
    else toast(toSave.length > 1 ? `${toSave.length} transactions validées` : 'Transaction validée', 'ok');
    router.replace(fiches.some((f) => f.later) ? '/pending' : '/(tabs)/transactions');
  };

  const pickedFiche = pick ? fiches.find((f) => f.id === pick.ficheId) : undefined;
  const busy = !!progress;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <Screen scroll keyboardAware>
        <ScreenHeader
          title="Trier et valider"
          back
          action={
            <PressScale onPress={() => setInfoOpen(true)} hitSlop={10} style={styles.infoBtn} accessibilityRole="button" accessibilityLabel="Comment ça marche">
              <Info color={color.primary} size={18} strokeWidth={2.2} />
            </PressScale>
          }
        />
        {q.isLoading && !q.data ? <PageSkeleton variant="pending" rows={3} /> : null}
        {q.isError && !q.data ? (
          <View style={styles.errorBox}>
            <Text style={styles.empty}>Les propositions n’ont pas pu être chargées. Vérifiez la connexion.</Text>
            <PressScale onPress={() => void q.refetch()} style={styles.retry} accessibilityRole="button">
              <Text style={styles.retryT}>{q.isFetching ? 'Chargement…' : 'Réessayer'}</Text>
            </PressScale>
          </View>
        ) : null}
        {q.isSuccess && fiches.length === 0 ? <Text style={styles.empty}>Aucune proposition à trier.</Text> : null}

        {fiches.map((f, fi) => {
          const w = walletOf(f.walletId);
          const t = total(f);
          const over = overdrawn.has(f.id);
          const cat = catName(f.categoryId);
          if (!f.later && folded.has(f.id)) {
            const n = validLines(f).length;
            return (
              <Animated.View key={f.id} layout={layout} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
                <PressScale
                  onPress={() => toggleFold(f.id)}
                  style={[styles.folded, over && styles.ficheErr]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: false }}
                  accessibilityLabel={`Fiche ${fi + 1}, ${w?.name ?? 'sans poche'}, ${n} ligne${n > 1 ? 's' : ''}, ${formatAmount(t)}. Déplier`}>
                  <Text style={styles.foldedN}>{fi + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.foldedName} numberOfLines={1}>
                      {w?.name ?? 'Poche à choisir'} · {f.type === 'income' ? 'Revenu' : 'Dépense'}
                    </Text>
                    <Text style={styles.foldedMeta} numberOfLines={1}>
                      {n === 0 ? 'Aucune ligne : sera ignorée' : `${n} ligne${n > 1 ? 's' : ''}${cat ? ` · ${cat}` : ''}`}
                    </Text>
                  </View>
                  {over ? <AlertCircle color={color.danger} size={16} /> : null}
                  <Text style={[styles.foldedAmt, { color: f.type === 'income' ? color.success : color.text }]}>
                    {t === 0 ? '' : f.type === 'income' ? '+' : '−'}
                    {formatAmount(t)}
                  </Text>
                  <ChevronDown color={color.textMuted} size={18} />
                </PressScale>
              </Animated.View>
            );
          }
          if (f.later) {
            return (
              <Animated.View key={f.id} layout={layout} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
                <PressScale onPress={() => patchFiche(f.id, { later: false })} style={styles.later} accessibilityRole="button">
                  <Clock color={color.textMuted} size={16} />
                  <Text style={styles.laterT} numberOfLines={1}>
                    Fiche {fi + 1} mise de côté · {formatAmount(t)}
                  </Text>
                  <Text style={styles.laterA}>Reprendre</Text>
                </PressScale>
              </Animated.View>
            );
          }
          return (
            <Animated.View key={f.id} layout={layout} entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={[styles.fiche, over && styles.ficheErr]}>
              <View style={styles.head}>
                <PressScale
                  onPress={() => toggleFold(f.id)}
                  hitSlop={8}
                  style={styles.fold}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: true }}
                  accessibilityLabel={`Replier la fiche ${fi + 1}`}>
                  <Text style={styles.ficheN} numberOfLines={1}>
                    Fiche {fi + 1} · {sourceLabel(f.source)}
                  </Text>
                  <ChevronUp color={color.primary} size={18} />
                  <Text style={styles.foldT}>Replier</Text>
                </PressScale>
              </View>
              <View style={styles.headActions}>
                <PressScale onPress={() => patchFiche(f.id, { later: true })} hitSlop={8} style={styles.headBtn} accessibilityRole="button" accessibilityLabel={`Mettre la fiche ${fi + 1} de côté`}>
                  <Clock color={color.textMuted} size={14} />
                  <Text style={styles.headBtnT}>Plus tard</Text>
                </PressScale>
                <PressScale
                  onPress={() => void clearFiche(f, fi)}
                  disabled={f.lines.length === 0}
                  hitSlop={8}
                  style={[styles.headBtn, f.lines.length === 0 && { opacity: 0.4 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Tout supprimer dans la fiche ${fi + 1}`}>
                  <Trash2 color={color.danger} size={14} />
                  <Text style={[styles.headBtnT, { color: color.danger }]}>Tout supprimer</Text>
                </PressScale>
              </View>

              <View style={styles.kinds}>
                {(['expense', 'income'] as const).map((k) => (
                  <PressScale key={k} onPress={() => setType(f, k)} style={[styles.kind, f.type === k && (k === 'expense' ? styles.kindOut : styles.kindIn)]} accessibilityRole="radio" accessibilityState={{ selected: f.type === k }}>
                    <Text style={[styles.kindT, f.type === k && { color: color.white }]}>{k === 'expense' ? 'Dépense' : 'Revenu'}</Text>
                  </PressScale>
                ))}
              </View>

              <View style={styles.picks}>
                <PressScale onPress={() => setPick({ kind: 'wallet', ficheId: f.id })} style={[styles.pick, !f.walletId && styles.pickMissing]} accessibilityRole="button">
                  <Text style={styles.pickK}>Poche</Text>
                  <Text style={[styles.pickV, !w && { color: color.danger }]} numberOfLines={1}>
                    {w?.name ?? 'À choisir'}
                  </Text>
                  {w ? <Text style={[styles.pickS, over && { color: color.danger }]}>Solde {formatAmount(w.current_balance)}</Text> : null}
                </PressScale>
                <PressScale onPress={() => setPick({ kind: 'cat', ficheId: f.id })} style={styles.pick} accessibilityRole="button">
                  <Text style={styles.pickK}>Catégorie</Text>
                  <Text style={[styles.pickV, !cat && { color: color.textMuted }]} numberOfLines={1}>
                    {cat ?? 'Aucune'}
                  </Text>
                </PressScale>
              </View>

              {f.lines.map((l, li) => {
                const effective = l.categoryId ? catName(l.categoryId) : cat;
                return (
                  <Animated.View key={l.id} layout={layout} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.line}>
                    <View style={styles.lineRow}>
                      <TextInput
                        value={l.description}
                        onChangeText={(v) => patchLine(f.id, l.id, { description: v })}
                        placeholder="Libellé"
                        placeholderTextColor={color.textMuted}
                        style={[styles.input, { flex: 1, minWidth: 0 }]}
                        accessibilityLabel={`Libellé, ligne ${li + 1} de la fiche ${fi + 1}`}
                      />
                      <TextInput
                        value={l.amount}
                        onChangeText={(v) => patchLine(f.id, l.id, { amount: v })}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        placeholderTextColor={color.textMuted}
                        style={[styles.input, styles.amount]}
                        accessibilityLabel={`Montant, ligne ${li + 1} de la fiche ${fi + 1}`}
                      />
                    </View>
                    <PressScale onPress={() => setPick({ kind: 'lineCat', ficheId: f.id, lineId: l.id })} style={styles.lineCat} accessibilityRole="button" accessibilityLabel={`Catégorie de la ligne : ${effective ?? 'aucune'}`}>
                      <Tag color={effective ? color.primary : color.textMuted} size={13} />
                      <Text style={[styles.lineCatT, !effective && { color: color.textMuted }]} numberOfLines={1}>
                        {effective ?? 'Choisir une catégorie'}
                      </Text>
                    </PressScale>
                    <View style={styles.lineTools}>
                      <PressScale onPress={() => moveWithin(f.id, l.id, -1)} disabled={li === 0} hitSlop={6} style={[styles.tool, li === 0 && styles.toolOff]} accessibilityLabel="Monter la ligne">
                        <ArrowUp color={color.textSecondary} size={16} />
                      </PressScale>
                      <PressScale onPress={() => moveWithin(f.id, l.id, 1)} disabled={li === f.lines.length - 1} hitSlop={6} style={[styles.tool, li === f.lines.length - 1 && styles.toolOff]} accessibilityLabel="Descendre la ligne">
                        <ArrowDown color={color.textSecondary} size={16} />
                      </PressScale>
                      <PressScale onPress={() => setPick({ kind: 'move', ficheId: f.id, lineId: l.id })} hitSlop={6} style={[styles.tool, styles.toolMove]} accessibilityRole="button" accessibilityLabel="Déplacer la ligne vers une autre fiche">
                        <ArrowRightLeft color={color.primary} size={15} />
                        <Text style={styles.moveT}>Déplacer</Text>
                      </PressScale>
                      <PressScale onPress={() => removeLine(f.id, l.id)} hitSlop={6} style={styles.tool} accessibilityLabel="Supprimer la ligne">
                        <Trash2 color={color.danger} size={16} />
                      </PressScale>
                    </View>
                  </Animated.View>
                );
              })}
              {f.lines.length === 0 ? <Text style={styles.noLine}>Plus aucune ligne : cette fiche sera ignorée.</Text> : null}
              <PressScale onPress={() => addLine(f.id)} style={styles.addLine} accessibilityRole="button">
                <Plus color={color.primary} size={15} strokeWidth={2.4} />
                <Text style={styles.addLineT}>Ajouter une ligne</Text>
              </PressScale>
              <View style={styles.totalRow}>
                <Text style={styles.totalK}>Total de la fiche</Text>
                <Text style={[styles.totalV, { color: f.type === 'income' ? color.success : over ? color.danger : color.text }]}>
                  {t === 0 ? '' : f.type === 'income' ? '+' : '−'}
                  {formatAmount(t)}
                </Text>
              </View>
              {over ? (
                <View style={styles.err}>
                  <AlertCircle color={color.danger} size={15} />
                  <Text style={styles.errT}>
                    Dépasse le solde de {w?.name}. Déplacez des lignes ou changez de poche.
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          );
        })}
        <View style={{ height: 130 }} />
      </Screen>

      {fiches.length ? (
        <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.barK} numberOfLines={1}>
              {toSave.length} fiche{toSave.length > 1 ? 's' : ''} à valider
            </Text>
            <Text style={styles.barV} numberOfLines={2}>
              {sumExpense ? <Text style={{ color: color.danger }}>−{formatAmount(sumExpense)}</Text> : null}
              {sumExpense && sumIncome ? '  ' : ''}
              {sumIncome ? <Text style={{ color: color.success }}>+{formatAmount(sumIncome)}</Text> : null}
              {!sumExpense && !sumIncome ? formatAmount(0) : null}
            </Text>
          </View>
          <PressScale
            onPress={() => void validateAll()}
            disabled={busy}
            style={[styles.save, busy && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            accessibilityLabel="Tout valider">
            {busy ? <ActivityIndicator color={color.white} /> : null}
            <Text style={styles.saveT}>{busy ? `Validation ${progress!.done}/${progress!.total}` : 'Tout valider'}</Text>
          </PressScale>
        </View>
      ) : null}

      <Sheet
        open={pick !== null}
        onClose={() => setPick(null)}
        title={pick?.kind === 'wallet' ? 'Poche' : pick?.kind === 'move' ? 'Déplacer vers' : 'Catégorie'}>
        {pick?.kind === 'wallet' ? (
          <OptionList
            options={wallets.map(walletOption)}
            value={pickedFiche?.walletId ?? ''}
            onChange={(v) => {
              patchFiche(pick.ficheId, { walletId: v });
              setPick(null);
            }}
          />
        ) : null}
        {pick?.kind === 'cat' && pickedFiche ? (
          <OptionList
            options={[{ value: '', label: 'Aucune catégorie' }, ...catsFor(pickedFiche.type).map(categoryOption)]}
            value={pickedFiche.categoryId}
            onChange={(v) => {
              patchFiche(pick.ficheId, { categoryId: v });
              setPick(null);
            }}
          />
        ) : null}
        {pick?.kind === 'lineCat' && pickedFiche ? (
          <OptionList
            options={[
              { value: '', label: `Celle de la fiche${catName(pickedFiche.categoryId) ? ` (${catName(pickedFiche.categoryId)})` : ''}` },
              ...catsFor(pickedFiche.type).map(categoryOption),
            ]}
            value={pickedFiche.lines.find((l) => l.id === pick.lineId)?.categoryId ?? ''}
            onChange={(v) => {
              patchLine(pick.ficheId, pick.lineId, { categoryId: v });
              setPick(null);
            }}
          />
        ) : null}
        {pick?.kind === 'move' ? (
          <OptionList
            options={[
              ...fiches
                .map((f, i) => ({ f, i }))
                .filter(({ f }) => f.id !== pick.ficheId && !f.later)
                .map(({ f, i }) => ({
                  value: f.id,
                  label: `Fiche ${i + 1} · ${walletOf(f.walletId)?.name ?? 'sans poche'} · ${formatAmount(total(f))}`,
                })),
              { value: 'new', label: '+ Nouvelle fiche' },
            ]}
            onChange={(v) => {
              moveLine(pick.ficheId, pick.lineId, v as string);
              setPick(null);
            }}
          />
        ) : null}
      </Sheet>
      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} info={INFO} />
    </View>
  );
}

const styles = StyleSheet.create({
  infoBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: color.primaryLight, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: font.sans, fontSize: 15, color: color.textMuted, textAlign: 'center', marginTop: 24 },
  errorBox: { alignItems: 'center', gap: 14 },
  retry: { minHeight: 44, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: color.primary, justifyContent: 'center' },
  retryT: { fontFamily: font.sansSemi, fontSize: 15, color: color.white },
  fiche: {
    backgroundColor: color.white,
    borderRadius: radius.largeCard,
    borderWidth: 1,
    borderColor: color.border,
    padding: 16,
    marginBottom: 14,
    gap: 12,
    ...shadow.card,
  },
  ficheErr: { borderColor: '#FDA29B' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fold: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  foldT: { fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  folded: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.card, backgroundColor: color.surface, borderWidth: 1, borderColor: 'transparent', marginBottom: 10 },
  foldedN: { width: 18, textAlign: 'center', fontFamily: font.sansBold, fontSize: 14, color: color.textMuted },
  foldedName: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  foldedMeta: { fontFamily: font.sans, fontSize: 12, color: color.textSecondary, marginTop: 2 },
  foldedAmt: { fontFamily: font.sansBold, fontSize: 15 },
  ficheN: { flexShrink: 1, fontFamily: font.sansBold, fontSize: 14, color: color.primary },
  headActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: -4 },
  headBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  headBtnT: { fontFamily: font.sansMed, fontSize: 13, color: color.textMuted },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { flex: 1, minHeight: 40, borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  kindOut: { backgroundColor: color.danger },
  kindIn: { backgroundColor: color.success },
  kindT: { fontFamily: font.sansSemi, fontSize: 14, color: color.textSecondary },
  picks: { flexDirection: 'row', gap: 10 },
  pick: { flex: 1, minWidth: 0, minHeight: 64, padding: 12, borderRadius: radius.md, backgroundColor: color.surface, justifyContent: 'center' },
  pickMissing: { borderWidth: 1.5, borderColor: '#FDA29B' },
  pickK: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
  pickV: { fontFamily: font.sansSemi, fontSize: 15, color: color.text, marginTop: 2 },
  pickS: { fontFamily: font.sans, fontSize: 12, color: color.textSecondary, marginTop: 2 },
  line: { gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  lineRow: { flexDirection: 'row', gap: 8 },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: 12,
    fontFamily: font.sans,
    fontSize: 16,
    color: color.text,
  },
  amount: { width: 108, textAlign: 'right', fontFamily: font.sansSemi },
  lineTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  lineCat: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  lineCatT: { flexShrink: 1, fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  tool: { minWidth: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolOff: { opacity: 0.3 },
  toolMove: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, backgroundColor: color.primaryLight },
  moveT: { fontFamily: font.sansSemi, fontSize: 12, color: color.primary },
  noLine: { fontFamily: font.sansMed, fontSize: 13, color: color.textMuted },
  addLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: radius.md, backgroundColor: color.primaryVeryLight },
  addLineT: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  totalK: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary },
  totalV: { fontFamily: font.sansBold, fontSize: 18, fontVariant: ['tabular-nums'] },
  err: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: radius.md, backgroundColor: '#FEF3F2' },
  errT: { flex: 1, fontFamily: font.sansMed, fontSize: 13, lineHeight: 19, color: color.danger },
  later: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.card, backgroundColor: color.surface, marginBottom: 10 },
  laterT: { flex: 1, fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary },
  laterA: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
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
  barV: { fontFamily: font.sansBold, fontSize: 18, color: color.text, fontVariant: ['tabular-nums'] },
  save: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 20, borderRadius: radius.button, backgroundColor: color.primary },
  saveT: { fontFamily: font.sansSemi, fontSize: 15, color: color.white },
});
