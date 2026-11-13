import {
  analyticsApi,
  budgetApi,
  pendingTransactionApi,
  savingsGoalApi,
  transactionApi,
  walletApi,
  type Budget,
  type SavingsGoal,
} from './api';
import { sortTransactionsByDateDesc } from './utils';

/** Nombre de requêtes du tableau de bord : base du pourcentage de l'écran de chargement. */
export const HOME_STEPS = 6;

/**
 * Données de l'accueil. `onStep` est appelé à chaque requête terminée (succès ou échec) :
 * l'écran de chargement avance au rythme réel du réseau.
 */
export async function fetchHomeData(isPremium: boolean, onStep?: (label: string) => void) {
  const now = new Date();
  const step = <T,>(p: Promise<T>, label: string) =>
    p.finally(() => {
      onStep?.(label);
    });
  const [wallets, balance, txs, stats, pending, extra] = await Promise.all([
    step(walletApi.getAll().catch(() => []), 'Vos poches'),
    // Une nouvelle tentative, sinon null : le solde est alors recalculé à partir des poches (jamais un faux « 0 »).
    step(
      walletApi
        .getTotalBalance()
        .catch(() => walletApi.getTotalBalance())
        .catch(() => null),
      'Votre solde'
    ),
    // Seules les 5 dernières sont affichées : inutile d’en charger davantage.
    step(transactionApi.getAll({ limit: 5 }).catch(() => []), 'Vos dernières transactions'),
    step(analyticsApi.getCurrentMonth().catch(() => null), 'Votre mois'),
    step(pendingTransactionApi.getCount().catch(() => ({ count: 0 })), 'Vos propositions'),
    step(
      isPremium
        ? Promise.all([
            budgetApi.getAll(now.getFullYear(), now.getMonth() + 1).catch(() => [] as Budget[]),
            savingsGoalApi.getAll().catch(() => [] as SavingsGoal[]),
          ])
        : Promise.resolve([[], []] as [Budget[], SavingsGoal[]]),
      'Vos objectifs'
    ),
  ]);
  const [budgets, goals] = extra;
  const fromWallets = wallets.reduce((s, w) => s + (w.current_balance || 0), 0);
  return {
    wallets,
    total: balance ? balance.total : fromWallets,
    savings: balance?.totalSavings ?? 0,
    recent: sortTransactionsByDateDesc(txs).slice(0, 5),
    stats,
    pending: pending.count,
    budgets: Array.isArray(budgets) ? budgets : [],
    goals: Array.isArray(goals) ? goals : [],
  };
}
