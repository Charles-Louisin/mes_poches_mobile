import { fetchApiBlob } from './api-client';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export async function shareExport(endpoint: string, filename: string): Promise<void> {
  const blob = await fetchApiBlob(endpoint);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
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
