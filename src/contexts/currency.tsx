import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/lib/api';
import {
  type AppCurrency,
  DEFAULT_CURRENCY,
  detectCurrencyFromLocale,
  isValidCurrency,
} from '@/lib/currencies';
import { formatCurrency } from '@/lib/utils';
import { STORAGE_KEYS, getString, setString } from '@/lib/storage';
import { useAuth } from './auth';

type CurrencyContextValue = {
  currency: AppCurrency;
  formatAmount: (n: number) => string;
  setCurrency: (next: AppCurrency) => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [currency, setCurrencyState] = useState<AppCurrency>(DEFAULT_CURRENCY);

  useEffect(() => {
    void (async () => {
      const stored = await getString(STORAGE_KEYS.currency);
      if (stored && isValidCurrency(stored)) {
        setCurrencyState(stored);
        return;
      }
      if (user?.currency && isValidCurrency(user.currency)) {
        setCurrencyState(user.currency);
        return;
      }
      setCurrencyState(detectCurrencyFromLocale());
    })();
  }, [user?.currency]);

  const setCurrency = useCallback(
    async (next: AppCurrency) => {
      setCurrencyState(next);
      await setString(STORAGE_KEYS.currency, next);
      if (token) {
        await authApi.updateMe({ currency: next });
      }
    },
    [token]
  );

  const value = useMemo(
    () => ({
      currency,
      formatAmount: (n: number) => formatCurrency(n, currency),
      setCurrency,
    }),
    [currency, setCurrency]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
