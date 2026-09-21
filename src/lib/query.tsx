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

export function invalidateFinance() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['home'] }),
    queryClient.invalidateQueries({ queryKey: ['wallets'] }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['categories'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['pending'] }),
    queryClient.invalidateQueries({ queryKey: ['me'] }),
    queryClient.invalidateQueries({ queryKey: ['budgets'] }),
    queryClient.invalidateQueries({ queryKey: ['goals'] }),
    queryClient.invalidateQueries({ queryKey: ['recurring'] }),
    queryClient.invalidateQueries({ queryKey: ['planned'] }),
    queryClient.invalidateQueries({ queryKey: ['objectifs'] }),
    queryClient.invalidateQueries({ queryKey: ['wallet'] }),
    queryClient.invalidateQueries({ queryKey: ['transaction'] }),
  ]);
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
