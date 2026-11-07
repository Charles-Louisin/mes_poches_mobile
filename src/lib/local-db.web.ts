import { STORAGE_KEYS, getJson, setJson } from './storage';

type CacheBundle = {
  wallets?: unknown;
  categories?: unknown;
  transactions?: unknown;
  pending?: unknown;
  totalBalance?: unknown;
  updatedAt: number;
};

const KEY = `${STORAGE_KEYS.user}_finance_cache`;

export async function readFinanceCache(): Promise<CacheBundle | null> {
  return getJson<CacheBundle>(KEY);
}

export async function writeFinanceCache(partial: Partial<CacheBundle>): Promise<void> {
  const prev = (await readFinanceCache()) ?? { updatedAt: 0 };
  const next: CacheBundle = { ...prev, ...partial, updatedAt: Date.now() };
  await setJson(KEY, next);
}
