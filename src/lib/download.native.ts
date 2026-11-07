import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { saveToDownloads } from 'sms-monitor';
import { getApiUrl } from './api-config';
import { ApiError, isNetworkFailure, NETWORK_ERROR_MESSAGE, PremiumRequiredError } from './errors';
import { getToken } from './secure-token';
import { revokeSession } from './session';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export type ExportSaveResult = 'downloads' | 'shared';

export function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export function exportSavedToast(result: ExportSaveResult): { message: string; tone: 'ok' | 'info' } {
  if (result === 'downloads') {
    return { message: 'Fichier enregistré dans Téléchargements.', tone: 'ok' };
  }
  return { message: 'Choisissez où enregistrer le fichier.', tone: 'info' };
}

function mapDownloadError(err: unknown): never {
  const raw = err instanceof Error ? err.message : String(err);
  if (/401/.test(raw)) {
    void revokeSession('expired');
    throw new ApiError('Session expirée. Reconnectez-vous.', { code: 'SESSION_REVOKED', status: 401 });
  }
  if (/403/.test(raw) || /PREMIUM/i.test(raw)) {
    throw new PremiumRequiredError('L’export est réservé aux abonnés Premium');
  }
  if (isNetworkFailure(err) || /unknownhost|unable to resolve host|failed to fetch|fetch failed/i.test(raw)) {
    throw new ApiError(NETWORK_ERROR_MESSAGE, { code: 'NETWORK' });
  }
  throw new ApiError('Téléchargement impossible. Réessayez.', { code: 'NETWORK' });
}

async function persistToDownloads(file: File, safeName: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const uri = await saveToDownloads(file.uri, safeName, mimeFor(safeName));
  return Boolean(uri);
}

/** Télécharge le fichier API et l’enregistre dans le stockage du téléphone. */
export async function shareExport(endpoint: string, filename: string): Promise<ExportSaveResult> {
  const token = getToken();
  if (!token) {
    void revokeSession('expired');
    throw new ApiError('Session expirée. Reconnectez-vous.', { code: 'SESSION_REVOKED', status: 401 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = new File(Paths.cache, safeName);

  let file: File;
  try {
    file = await File.downloadFileAsync(`${getApiUrl()}${endpoint}`, dest, {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
  } catch (err) {
    mapDownloadError(err);
  }

  try {
    if (await persistToDownloads(file, safeName)) return 'downloads';
  } catch {
    /* partage ci-dessous */
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: mimeFor(safeName),
      dialogTitle: safeName,
      UTI: mimeFor(safeName),
    });
    return 'shared';
  }
  throw new ApiError('Enregistrement impossible. Réessayez.', { code: 'NETWORK' });
}

/** @deprecated Utiliser shareExport */
export async function shareBlob(_blob: Blob, filename: string): Promise<void> {
  throw new ApiError(`Utilisez shareExport pour ${filename}`);
}
