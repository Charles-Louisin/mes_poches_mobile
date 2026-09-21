import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { walletApi } from '@/lib/api';
import { useCurrency } from '@/contexts/currency';
import { PocketArt } from '@/components/illustrations';
import { TutorialTarget } from '@/components/tutorial/tutorial-target';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Passbook } from '@/components/ui/passbook';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { color, radius, typeScale } from '@/theme/tokens';

export default function WalletsScreen() {
  const { formatAmount } = useCurrency();
  const q = useQuery({ queryKey: ['wallets'], queryFn: () => walletApi.getAll() });

  return (
    <Screen scroll onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={styles.top}>
        <Text style={styles.title}>Poches</Text>
        <TutorialTarget id="wallet-add" style={styles.addTarget}>
          <PressScale
            onPress={() => router.push('/wallets/new')}
            style={styles.add}
            accessibilityLabel="Nouvelle poche">
            <Plus color={color.white} size={22} strokeWidth={2.4} />
          </PressScale>
        </TutorialTarget>
      </View>
      {(q.data ?? []).map((w, i) => (
        <Passbook
          key={w._id}
          index={i}
          name={w.name}
          amount={formatAmount(w.current_balance)}
          monthIncome={w.month_income ?? 0}
          monthExpense={w.month_expense ?? 0}
          formatAmount={formatAmount}
          imageUrl={w.image_url}
          onPress={() => router.push(`/wallets/${w._id}`)}
        />
      ))}
      {q.isLoading && !q.data ? (
        <PageSkeleton variant="cards" rows={3} />
      ) : q.data?.length === 0 ? (
        <EmptyState
          illustration={<PocketArt size={200} />}
          title="Aucune poche"
          description="Ouvrez une poche pour Cash, Orange ou MTN. Le solde se calcule tout seul."
          cta="Créer une poche"
          onPress={() => router.push('/wallets/new')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { ...typeScale.h1, color: color.text },
  addTarget: { width: 44, height: 44 },
  add: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
