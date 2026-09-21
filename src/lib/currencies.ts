import { getCalendars, getLocales } from 'expo-localization';

export const DEFAULT_CURRENCY = 'XAF' as const;

export const WALLET_CURRENCIES = [
  { value: 'XAF', label: 'XAF — Franc CFA CEMAC' },
  { value: 'XOF', label: 'XOF — Franc CFA UEMOA' },
  { value: 'EURO', label: 'Euro (€)' },
  { value: 'DOLLARS', label: 'Dollars ($)' },
] as const;

export type AppCurrency = (typeof WALLET_CURRENCIES)[number]['value'];

const VALID_CURRENCIES = new Set<string>(WALLET_CURRENCIES.map((c) => c.value));

export function isValidCurrency(value: string): value is AppCurrency {
  return VALID_CURRENCIES.has(value);
}

const XOF_REGIONS = new Set(['SN', 'CI', 'BJ', 'TG', 'ML', 'NE', 'BF', 'GW', 'MR']);
const XAF_REGIONS = new Set(['CM', 'CF', 'TD', 'CG', 'GA', 'GQ', 'CD']);
const EUR_REGIONS = new Set([
  'FR', 'DE', 'BE', 'ES', 'IT', 'PT', 'NL', 'LU', 'AT', 'IE', 'FI', 'GR',
]);

export function detectCurrencyFromLocale(): AppCurrency {
  const locale = getLocales()[0];
  const region = locale?.regionCode?.toUpperCase();

  if (region === 'US') return 'DOLLARS';
  if (region && EUR_REGIONS.has(region)) return 'EURO';
  if (region && XOF_REGIONS.has(region)) return 'XOF';
  if (region && XAF_REGIONS.has(region)) return 'XAF';

  try {
    const tz = getCalendars()[0]?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/Abidjan|Dakar|Bamako|Ouagadougou|Lome|Niamey|Bissau/i.test(tz)) return 'XOF';
    if (/Douala|Kinshasa|Libreville|Bangui|Ndjamena|Malabo/i.test(tz)) return 'XAF';
    if (/Paris|Brussels|Berlin|Madrid|Rome|Amsterdam/i.test(tz)) return 'EURO';
    if (/New_York|Los_Angeles|Chicago/i.test(tz)) return 'DOLLARS';
  } catch {
    /* ignore */
  }

  return DEFAULT_CURRENCY;
}

export function getCurrencySymbol(currency: string): string {
  switch (currency) {
    case 'EURO':
      return '€';
    case 'DOLLARS':
      return '$';
    case 'XOF':
      return 'XOF';
    case 'XAF':
    default:
      return 'XAF';
  }
}
