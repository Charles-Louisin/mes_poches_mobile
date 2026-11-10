import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, ScanLine, Settings, X } from 'lucide-react-native';
import {
  analyticsApi,
  type MeUser,
  budgetApi,
  categoryApi,
  pendingTransactionApi,
  savingsGoalApi,
  transactionApi,
  walletApi,
} from '@/lib/api';
import { STORAGE_KEYS, getString, setString } from '@/lib/storage';
import { formatDate, sortTransactionsByDateDesc } from '@/lib/utils';
import { useAuth } from '@/contexts/auth';
import { useCurrency } from '@/contexts/currency';
import { useReceiptScan } from '@/contexts/receipt-scan';
import { BrandMark } from '@/components/brand/brand-mark';
import { BalanceCard } from '@/components/ui/balance-card';
import { Card } from '@/components/ui/card';
import { Enter } from '@/components/ui/enter';
import { InkBar } from '@/components/ui/ink-bar';
import { Passbook } from '@/components/ui/passbook';
import { PressScale } from '@/components/ui/press-scale';
import { QuickActions } from '@/components/ui/quick-actions';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { TransactionItem } from '@/components/ui/transaction-item';
import { useTutorial } from '@/contexts/tutorial';
import { blockIfQuotaFull } from '@/components/subscription/quota-prompt';
import { getTrialDaysLeft } from '@/lib/subscription';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { PocketArt, ReceiptArt } from '@/components/illustrations';
import { color, radius, space, type as font, typeScale } from '@/theme/tokens';

function QuotaHints({ quotas }: { quotas?: MeUser['quotas'] }) {
  const items = Object.values(quotas ?? {}).filter(
    (q) => q.limit != null && q.limit > 0 && q.used / q.limit >= 0.8 && (q.remaining ?? 0) > 0
  );
  if (!items.length) return null;
  return (
    <View style={styles.quotaBox}>
      {items.map((q) => {
        const ratio = Math.min(1, q.used / (q.limit || 1));
        const when = q.period === 'month' ? ' ce mois-ci' : '';
        return (
          <View key={q.key} style={styles.quotaItem}>
            <View style={styles.quotaTrack}>
              <View style={[styles.quotaFill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
            <Text style={styles.quotaT}>
              Il vous reste {q.remaining} {q.label}
              {when}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const { user, isPremium, isOnTrial } = useAuth();
  const { formatAmount } = useCurrency();
  const { startScan } = useReceiptScan();
  const { active: tutorialOn } = useTutorial();
  const [hidden, setHidden] = useState(false);
  const [hideTrial, setHideTrial] = useState(true);

  const trialKey = user ? `${STORAGE_KEYS.hideTrial}:${user.id}:${user.premiumUntil ?? ''}` : '';

  useEffect(() => {
    void getString(STORAGE_KEYS.hideBalance).then((v) => setHidden(v === '1'));
  }, []);

  useEffect(() => {
    if (!trialKey) return;
    void getString(trialKey).then((v) => setHideTrial(v === '1'));
  }, [trialKey]);

  const toggleHide = () => {
    setHidden((h) => {
      const next = !h;
      void setString(STORAGE_KEYS.hideBalance, next ? '1' : '0');
      return next;
    });
  };

  const home = useQuery({
    queryKey: ['home', isPremium],
    queryFn: async () => {
      const now = new Date();
      const [wallets, balance, txs, stats, pending, budgets, goals] = await Promise.all([
        walletApi.getAll().catch(() => []),
        walletApi.getTotalBalance().catch(() => ({ total: 0, totalSavings: 0, wallets: [] })),
        transactionApi.getAll({ limit: 200 }).catch(() => []),
        analyticsApi.getCurrentMonth().catch(() => null),
        pendingTransactionApi.getCount().catch(() => ({ count: 0 })),
        isPremium
          ? budgetApi.getAll(now.getFullYear(), now.getMonth() + 1).catch(() => [])
          : Promise.resolve([]),
        isPremium ? savingsGoalApi.getAll().catch(() => []) : Promise.resolve([]),
        categoryApi.getAll().catch(() => []),
      ]);
      return {
        wallets,
        total: balance.total,
        savings: balance.totalSavings ?? 0,
        recent: sortTransactionsByDateDesc(txs).slice(0, 5),
        stats,
        pending: pending.count,
        budgets: Array.isArray(budgets) ? budgets : [],
        goals: Array.isArray(goals) ? goals : [],
      };
    },
  });

  const data = home.data;
  const greeting = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const trialDays = getTrialDaysLeft(user);

  return (
    <Screen
      scroll
      onRefresh={() => {
        void home.refetch();
      }}
      refreshing={home.isRefetching}>
      <View style={styles.top}>
        <View style={styles.identity}>
          <BrandMark size={40} />
          <Text style={styles.hello}>MES POCHES</Text>
        </View>
        <View style={styles.topActions}>
          <PressScale
            onPress={() => router.push('/pending')}
            style={styles.iconBtn}
            accessibilityLabel="Notifications">
            <Bell color={color.text} size={20} strokeWidth={2} />
            {data && data.pending > 0 ? <View style={styles.dot} /> : null}
          </PressScale>
          <PressScale onPress={() => router.push('/settings')} style={styles.iconBtn} accessibilityLabel="Paramètres">
            <Settings color={color.text} size={20} strokeWidth={2} />
          </PressScale>
        </View>
      </View>

      <Enter delay={40}>
        <BalanceCard
          amount={data?.total ?? 0}
          format={formatAmount}
          income={data?.stats?.totalIncome}
          expense={data?.stats?.totalExpense}
          savings={isPremium ? data?.savings : 0}
          hidden={hidden}
          onToggleHide={toggleHide}
          holder={user?.name || greeting}
          planLabel={isOnTrial ? 'essai Pro' : isPremium ? user?.tierLabel || 'Premium' : 'gratuit'}
          admin={user?.role === 'admin'}
        />
      </Enter>

      <View style={{ height: space[20] }} />

      <QuickActions
        items={[
          {
            key: 'out',
            label: 'Dépense',
            Icon: ArrowUpRight,
            tone: 'danger',
            onPress: () => router.push('/transactions/new?type=expense'),
          },
          {
            key: 'in',
            label: 'Revenu',
            Icon: ArrowDownLeft,
            tone: 'success',
            onPress: () => router.push('/transactions/new?type=income'),
          },
          {
            key: 'scan',
            label: 'Scanner',
            Icon: ScanLine,
            tone: 'warning',
            onPress: () => {
              if (blockIfQuotaFull(user?.quotas, 'scans')) return;
              void startScan();
            },
          },
          {
            key: 'tf',
            label: 'Virement',
            Icon: ArrowLeftRight,
            tone: 'primary',
            onPress: () => router.push('/transactions/new?type=transfer'),
          },
        ]}
      />

      <QuotaHints quotas={user?.quotas} />
      {isOnTrial && !hideTrial && !tutorialOn ? (
        <View style={[styles.trial, trialDays <= 7 && styles.trialUrgent]}>
          <PressScale onPress={() => router.push('/subscription')} style={{ flex: 1 }}>
            <Text style={styles.trialK}>
              {trialDays <= 7 ? `Plus que ${trialDays} jour${trialDays > 1 ? 's' : ''} d’essai` : 'Essai Premium'}
            </Text>
            <Text style={styles.trialT}>
              {trialDays} jour{trialDays > 1 ? 's' : ''} restant{trialDays > 1 ? 's' : ''} — puis le plan gratuit, ou Premium.
            </Text>
          </PressScale>
          <PressScale
            hitSlop={8}
            onPress={() => {
              if (trialKey) void setString(trialKey, '1');
              setHideTrial(true);
            }}
            accessibilityLabel="Masquer">
            <X color={color.textMuted} size={18} />
          </PressScale>
        </View>
      ) : null}

      {data && data.pending > 0 ? (
        <PressScale onPress={() => router.push('/pending')} style={styles.pending}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingK}>En attente de validation</Text>
            <Text style={styles.pendingT}>
              {data.pending === 1 ? '1 transaction détectée' : `${data.pending} transactions détectées`}
            </Text>
          </View>
          <Text style={styles.pendingCta}>Voir</Text>
        </PressScale>
      ) : null}

      <View style={{ height: space[24] }} />

      {home.isLoading && !data ? (
        <PageSkeleton variant="home" />
      ) : (
        <>
      <SectionHeader title="Poches" action="Tout voir" onPress={() => router.push('/(tabs)/wallets')} />
      {(data?.wallets ?? []).slice(0, 3).map((w, i) => (
        <Passbook
          key={w._id}
          index={i}
          name={w.name}
          amount={hidden ? '••••' : formatAmount(w.current_balance)}
          monthIncome={w.month_income ?? 0}
          monthExpense={w.month_expense ?? 0}
          formatAmount={formatAmount}
          hidden={hidden}
          imageUrl={w.image_url}
          onPress={() => router.push(`/wallets/${w._id}`)}
        />
      ))}
      {data && data.wallets.length === 0 ? (
        <EmptyState
          illustration={<PocketArt size={180} />}
          title="Aucune poche"
          description="Ouvrez une poche pour Cash, Orange ou MTN. Le solde se calcule tout seul."
          cta="Créer une poche"
          onPress={() => router.push('/wallets/new')}
        />
      ) : null}

      {isPremium && (data?.budgets ?? []).length > 0 ? (
        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <SectionHeader title="Budgets" action="Objectifs" onPress={() => router.push('/objectifs')} />
          {data!.budgets.slice(0, 3).map((b, i) => {
            const pct = b.percent ?? ((b.spent ?? 0) / Math.max(1, b.limit_amount)) * 100;
            return (
              <Card key={b._id} style={{ marginBottom: 10 }}>
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetN}>{(b.category_id as { name?: string })?.name ?? 'Budget'}</Text>
                  <Text style={styles.budgetA}>
                    {formatAmount(b.spent ?? 0)} / {formatAmount(b.limit_amount)}
                  </Text>
                </View>
                <InkBar value={pct} tone={pct >= 100 ? 'danger' : 'primary'} delay={80 + i * 80} />
                {pct >= 100 ? <Text style={styles.over}>Budget dépassé</Text> : null}
              </Card>
            );
          })}
        </View>
      ) : null}

      {isPremium && (data?.goals ?? []).length > 0 ? (
        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <SectionHeader title="Épargne" action="Objectifs" onPress={() => router.push('/objectifs')} />
          {data!.goals.slice(0, 3).map((g, i) => {
            const current = g.current_amount ?? g.saved_amount ?? 0;
            const pct = g.progress_percent ?? (current / Math.max(1, g.target_amount)) * 100;
            return (
              <Card key={g._id} style={{ marginBottom: 10 }}>
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetN}>{g.title}</Text>
                  <Text style={styles.budgetA}>
                    {formatAmount(current)} / {formatAmount(g.target_amount)}
                  </Text>
                </View>
                <InkBar value={pct} tone="primary" delay={80 + i * 80} />
                {g.deadline ? <Text style={styles.limit}>Limite : {formatDate(g.deadline)}</Text> : null}
              </Card>
            );
          })}
        </View>
      ) : null}

      <View style={{ height: 8 }} />
      <SectionHeader title="Dernières transactions" action="Tout voir" onPress={() => router.push('/(tabs)/transactions')} />
      {(data?.recent ?? []).length === 0 ? (
        <EmptyState
          illustration={<ReceiptArt size={180} />}
          title="Pas encore de mouvement"
          description="Ajoutez une dépense ou un revenu. Le solde de vos poches se met à jour."
          cta="Ajouter"
          onPress={() => router.push('/transactions/new')}
        />
      ) : (
        <Card>
          {(data?.recent ?? []).map((t, i) => (
            <Enter key={t._id} delay={80 + i * 40}>
              <TransactionItem
                tx={t}
                formatAmount={formatAmount}
                onPress={() => router.push(`/transactions/${t._id}`)}
                exportRow
              />
            </Enter>
          ))}
        </Card>
      )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quotaBox: { gap: 8, marginBottom: 14 },
  quotaItem: { gap: 4 },
  quotaTrack: { height: 4, borderRadius: 4, backgroundColor: color.line, overflow: 'hidden' },
  quotaFill: { height: 4, backgroundColor: color.primary },
  quotaT: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 },
  hello: { ...typeScale.h2, color: color.text, marginTop: 1 },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: color.danger,
  },
  trial: {
    backgroundColor: color.primaryLight,
    borderRadius: radius.card,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  trialUrgent: {
    backgroundColor: '#FFF7E8',
  },
  trialK: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
  trialT: { fontFamily: font.sans, color: color.textSecondary, marginTop: 4, fontSize: 13, lineHeight: 19 },
  pending: {
    marginTop: 16,
    backgroundColor: '#FFF7E8',
    borderRadius: radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingK: { fontFamily: font.sansMed, fontSize: 12, color: color.warning },
  pendingT: { fontFamily: font.sansSemi, fontSize: 15, color: color.text, marginTop: 2 },
  pendingCta: { fontFamily: font.sansSemi, color: color.primary, fontSize: 14 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetN: { fontFamily: font.sansMed, color: color.text, fontSize: 14 },
  budgetA: { fontFamily: font.sans, color: color.textMuted, fontSize: 12 },
  over: { fontFamily: font.sansMed, color: color.danger, fontSize: 12, marginTop: 6 },
  limit: { fontFamily: font.sans, color: color.textMuted, fontSize: 12, marginTop: 6 },
});
