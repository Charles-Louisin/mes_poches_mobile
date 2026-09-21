import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { saveToDownloads } from 'sms-monitor';
import { getApiUrl } from './api-config';
import { ApiError, PremiumRequiredError } from './errors';
import { getToken } from './secure-token';
import { revokeSession } from './session';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
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
  throw new ApiError('Téléchargement impossible. Réessayez.', { code: 'NETWORK' });
}

async function persistLocal(file: File, safeName: string): Promise<void> {
  if (Platform.OS === 'android') {
    const uri = await saveToDownloads(file.uri, safeName, mimeFor(safeName));
    if (uri) return;
  }

  const dest = new File(Paths.document, safeName);
  if (dest.exists) dest.delete();
  await file.copy(dest);
}

/** Télécharge le fichier API et l’enregistre dans le stockage du téléphone. */
export async function shareExport(endpoint: string, filename: string): Promise<void> {
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
    await persistLocal(file, safeName);
  } catch {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: mimeFor(safeName),
        dialogTitle: safeName,
        UTI: mimeFor(safeName),
      });
      return;
    }
    throw new ApiError('Enregistrement impossible. Réessayez.', { code: 'NETWORK' });
  }
}

/** @deprecated Utiliser shareExport */
export async function shareBlob(_blob: Blob, filename: string): Promise<void> {
  throw new ApiError(`Utilisez shareExport pour ${filename}`);
}
