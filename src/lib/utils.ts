import { getCurrencySymbol } from './currencies';

export function formatCurrency(amount: number, currency: string = 'XAF'): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  if (currency === 'EURO') return `${formatted}\u00a0€`;
  if (currency === 'DOLLARS') return `${formatted}\u00a0$`;
  return `${formatted} ${getCurrencySymbol(currency)}`;
}

function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(date);
}

export function formatDate(date: string | Date): string {
  const d = parseDate(date);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTime(date: string | Date): string {
  const d = parseDate(date);
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function formatRelativeDate(date: string | Date): string {
  const d = parseDate(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return formatDate(d);
}

export function operationsLabel(count: number): string {
  return count > 1 ? `${count} mouvements` : `${count} mouvement`;
}

export function getTransactionTypeLabel(
  type: 'income' | 'expense' | 'transfer',
  savingsGoalId?: string | null
): string {
  if (savingsGoalId) return 'Épargne';
  switch (type) {
    case 'income':
      return 'Entrée';
    case 'expense':
      return 'Sortie';
    case 'transfer':
      return 'Virement';
  }
}

function compareAsc(a: { date: string; created_at?: string }, b: { date: string; created_at?: string }) {
  const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (diff !== 0) return diff;
  const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
  const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ca - cb;
}

export function sortTransactionsByDateDesc<T extends { date: string; created_at?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => -compareAsc(a, b));
}

export function dayKeyOf(date: string | Date): string {
  const d = parseDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dayKeyOf(new Date());
}

export function defaultOpenDayKey(dayKeys: string[]): string | null {
  if (!dayKeys.length) return null;
  const today = todayKey();
  return dayKeys.includes(today) ? today : dayKeys[0];
}

export function groupTransactionsByDate<T extends { date: string; created_at?: string }>(
  transactions: T[]
): { dayKey: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  sortTransactionsByDateDesc(transactions).forEach((t) => {
    const dayKey = dayKeyOf(t.date);
    const list = map.get(dayKey) ?? [];
    list.push(t);
    map.set(dayKey, list);
  });
  const today = todayKey();
  return Array.from(map.entries())
    .map(([dayKey, items]) => ({
      dayKey,
      label: formatRelativeDate(dayKey),
      items,
    }))
    .sort((a, b) => {
      if (a.dayKey === today) return -1;
      if (b.dayKey === today) return 1;
      return a.dayKey < b.dayKey ? 1 : -1;
    });
}

export function savingsGoalIdOf(
  value: { _id?: string } | string | null | undefined
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id ?? null;
}

export function idOf(value: { _id: string } | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'object') return value._id;
  return String(value);
}

export function nameOf(value: { name: string } | string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  if (typeof value === 'object' && 'name' in value) return value.name;
  return fallback;
}
