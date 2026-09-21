export const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function listMonths(from: Date, to = new Date()) {
  const options: { year: number; month: number; label: string }[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  let cursor = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor >= start) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    options.push({ year, month, label: monthLabel(year, month) });
    cursor = new Date(year, month - 2, 1);
  }
  if (!options.length) {
    options.push({
      year: to.getFullYear(),
      month: to.getMonth() + 1,
      label: monthLabel(to.getFullYear(), to.getMonth() + 1),
    });
  }
  return options;
}

export function fmtPct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n)} %`;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function compareMonths(
  selected: { totalIncome: number; totalExpense: number; balance: number; incomeCount: number; expenseCount: number },
  previous: { totalIncome: number; totalExpense: number; balance: number; incomeCount: number; expenseCount: number }
) {
  const delta = {
    totalIncome: selected.totalIncome - previous.totalIncome,
    totalExpense: selected.totalExpense - previous.totalExpense,
    balance: selected.balance - previous.balance,
    incomeCount: selected.incomeCount - previous.incomeCount,
    expenseCount: selected.expenseCount - previous.expenseCount,
  };
  const percent = {
    totalIncome: previous.totalIncome === 0 ? null : (delta.totalIncome / previous.totalIncome) * 100,
    totalExpense: previous.totalExpense === 0 ? null : (delta.totalExpense / previous.totalExpense) * 100,
    balance: previous.balance === 0 ? null : (delta.balance / Math.abs(previous.balance)) * 100,
  };
  return { delta, percent };
}
