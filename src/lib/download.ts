import { fetchApiBlob } from './api-client';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export type ExportSaveResult = 'saved' | 'cancelled' | 'shared';

/** Fuseau de l'appareil : les dates du fichier exporté suivent l'heure de l'utilisateur. */
function withTimeZone(endpoint: string): string {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    /* Intl indisponible */
  }
  if (!tz || endpoint.includes('tz=')) return endpoint;
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}tz=${encodeURIComponent(tz)}`;
}

export function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export function exportSavedToast(_result: ExportSaveResult): { message: string; tone: 'ok' | 'info' } {
  return { message: 'Fichier enregistré dans Téléchargements.', tone: 'ok' };
}

export async function shareExport(endpoint: string, filename: string): Promise<ExportSaveResult> {
  endpoint = withTimeZone(endpoint);
  const blob = await fetchApiBlob(endpoint);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
  return 'saved';
}

export async function shareBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
}
