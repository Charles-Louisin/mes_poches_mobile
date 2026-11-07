export type ExportGrain = 'month' | 'week' | 'day';

export type ExportPeriod = {
  key: string;
  label: string;
  group?: string;
  /** Début inclus, en heure locale de l'appareil. */
  start: string;
  /** Fin exclue. */
  end: string;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function cap(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function monthLabel(d: Date): string {
  return cap(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d));
}

function dayLabel(d: Date): string {
  return cap(
    new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  );
}

function shortDay(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function accountStart(createdAt: string | undefined, today: Date): Date {
  const parsed = createdAt ? new Date(createdAt) : today;
  if (Number.isNaN(parsed.getTime())) return today;
  const start = startOfDay(parsed);
  return start.getTime() > today.getTime() ? today : start;
}

/** Mois, semaines (lundi–dimanche) ou jours, du jour d'inscription jusqu'à aujourd'hui. */
export function listExportPeriods(
  createdAt: string | undefined,
  grain: ExportGrain,
  now = new Date()
): ExportPeriod[] {
  const today = startOfDay(now);
  const start = accountStart(createdAt, today);
  const items: ExportPeriod[] = [];

  if (grain === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor.getTime() <= last.getTime()) {
      const from = new Date(cursor);
      const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;
      items.push({ key, label: monthLabel(from), start: from.toISOString(), end: to.toISOString() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return items.reverse();
  }

  if (grain === 'week') {
    const cursor = startOfDay(start);
    const weekday = cursor.getDay();
    cursor.setDate(cursor.getDate() + (weekday === 0 ? -6 : 1 - weekday));
    while (cursor.getTime() <= today.getTime()) {
      const from = new Date(cursor);
      const to = addDays(from, 7);
      const lastDay = addDays(from, 6);
      items.push({
        key: ymd(from),
        label: `${shortDay(from)} – ${shortDay(lastDay)} ${lastDay.getFullYear()}`,
        group: monthLabel(from),
        start: from.toISOString(),
        end: to.toISOString(),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return items.reverse();
  }

  const cursor = new Date(start);
  while (cursor.getTime() <= today.getTime()) {
    const from = new Date(cursor);
    const to = addDays(from, 1);
    items.push({
      key: ymd(from),
      label: dayLabel(from),
      group: monthLabel(from),
      start: from.toISOString(),
      end: to.toISOString(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return items.reverse();
}
