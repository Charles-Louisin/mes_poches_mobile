import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
    },
  },
});

export function getQueryClient() {
  return queryClient;
}

const FINANCE_KEYS = [
  'home',
  'wallets',
  'transactions',
  'categories',
  'category',
  'category-transactions',
  'analytics',
  'analytics-month',
  'pending',
  'me',
  'budgets',
  'goals',
  'recurring',
  'planned',
  'objectifs',
  'objectifs-history',
  'wallet',
  'transaction',
];

/**
 * Données financières périmées après une écriture.
 * Ne bloque pas l’interface : les écrans visibles se rechargent en arrière-plan, les autres au prochain
 * affichage. (Avant, chaque action attendait le rechargement de tous les écrans ouverts.)
 */
export function invalidateFinance(): Promise<void> {
  for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
  return Promise.resolve();
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
