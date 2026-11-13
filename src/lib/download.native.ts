import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { getApiUrl } from './api-config';
import { ApiError, isNetworkFailure, NETWORK_ERROR_MESSAGE, PremiumRequiredError } from './errors';
import { getToken, loadToken } from './secure-token';
import { revokeSession } from './session';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** saved : enregistré dans le dossier choisi · cancelled : choix du dossier annulé · shared : feuille de partage (iOS). */
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

export function exportSavedToast(result: ExportSaveResult): { message: string; tone: 'ok' | 'info' } {
  if (result === 'saved') return { message: 'Fichier enregistré.', tone: 'ok' };
  if (result === 'cancelled') return { message: 'Enregistrement annulé.', tone: 'info' };
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

/** content://…/tree/X (dossier choisi) → content://…/document/X, que le gestionnaire de fichiers sait ouvrir. */
export function folderDocumentUri(treeUri: string): string {
  const match = treeUri.match(/^(content:\/\/[^/]+)\/tree\/([^/]+)/);
  return match ? `${match[1]}/document/${match[2]}` : treeUri;
}

const FLAG_GRANT_READ = 1;
const FLAG_NEW_TASK = 0x10000000;

async function openFolder(folderUri: string, fileUri: string, mime: string): Promise<void> {
  const flags = FLAG_GRANT_READ | FLAG_NEW_TASK;
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: folderDocumentUri(folderUri),
      type: 'vnd.android.document/directory',
      flags,
    });
    return;
  } catch {
    /* pas de gestionnaire de dossiers : on ouvre le fichier lui-même */
  }
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: fileUri, type: mime, flags });
  } catch {
    Alert.alert('Ouverture impossible', 'Ouvrez l’application Fichiers pour retrouver le document.');
  }
}

function askOpenFolder(folderName: string, onOpen: () => void) {
  Alert.alert(
    'Fichier enregistré',
    `Le fichier est dans « ${folderName} ». Voulez-vous ouvrir ce dossier ?`,
    [
      { text: 'Non', style: 'cancel' },
      { text: 'Ouvrir le dossier', onPress: onOpen },
    ]
  );
}

function isCancel(err: unknown): boolean {
  const raw = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /cancel|annul|no directory|aborted/i.test(raw);
}

/**
 * Télécharge l'export, demande le dossier où l'enregistrer (Android),
 * l'y écrit, puis propose d'ouvrir ce dossier.
 */
export async function shareExport(endpoint: string, filename: string): Promise<ExportSaveResult> {
  endpoint = withTimeZone(endpoint);
  const token = getToken() ?? (await loadToken());
  if (!token) {
    void revokeSession('expired');
    throw new ApiError('Session expirée. Reconnectez-vous.', { code: 'SESSION_REVOKED', status: 401 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const mime = mimeFor(safeName);
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

  if (Platform.OS === 'android') {
    let folder: Directory;
    try {
      folder = await Directory.pickDirectoryAsync();
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
      throw new ApiError('Impossible d’ouvrir le choix du dossier. Réessayez.');
    }
    try {
      const target = folder.createFile(safeName, mime);
      await target.write(await file.bytes());
      const folderName = decodeURIComponent(folder.uri.split('/').pop() || '').split(':').pop() || 'le dossier choisi';
      askOpenFolder(folderName, () => void openFolder(folder.uri, target.uri, mime));
      return 'saved';
    } catch {
      throw new ApiError('Enregistrement impossible dans ce dossier. Choisissez-en un autre.');
    } finally {
      try {
        file.delete();
      } catch {
        /* cache */
      }
    }
  }

  // iOS : la feuille de partage propose « Enregistrer dans Fichiers » (choix du dossier).
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: safeName, UTI: mime });
    return 'shared';
  }
  throw new ApiError('Enregistrement impossible. Réessayez.', { code: 'NETWORK' });
}

/** @deprecated Utiliser shareExport */
export async function shareBlob(_blob: Blob, filename: string): Promise<void> {
  throw new ApiError(`Utilisez shareExport pour ${filename}`);
}
