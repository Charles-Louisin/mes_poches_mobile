import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { getApiUrl } from './api-config';
import { ApiError } from './errors';
import { compressImageForUpload } from './image-compress';
import { loadToken } from './secure-token';

export type UploadImageEndpoint = 'categoryImage' | 'walletImage';

function guessMime(uri: string): string {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

async function appendImage(form: FormData, uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await fetch(uri).then((r) => r.blob());
    const file = new globalThis.File([blob], 'mes-poches.jpg', { type: blob.type || 'image/jpeg' });
    form.append('file', file);
    return;
  }

  try {
    const nativeFile = new File(uri);
    if (nativeFile.exists) {
      form.append('file', nativeFile as unknown as Blob);
      return;
    }
  } catch {
    /* fallback objet RN */
  }

  const mime = guessMime(uri);
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  form.append('file', {
    uri,
    name: `mes-poches.${ext}`,
    type: mime,
  } as unknown as Blob);
}

export async function uploadEntityImage(
  uri: string,
  endpoint: UploadImageEndpoint
): Promise<string> {
  const token = await loadToken();
  if (!token) {
    throw new ApiError('Session expirée. Reconnectez-vous.', { code: 'UNAUTHORIZED', status: 401 });
  }

  let source = uri;
  try {
    source = (await compressImageForUpload(uri)).uri;
  } catch {
    source = uri;
  }

  const form = new FormData();
  await appendImage(form, source);
  form.append('endpoint', endpoint);

  const response = await fetch(`${getApiUrl()}/upload/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  type UploadResponse = { success?: boolean; message?: string; data?: { url?: string } };
  let payload: UploadResponse | null = null;
  try {
    payload = (await response.json()) as UploadResponse;
  } catch {
    payload = null;
  }

  if (response.status === 503) {
    throw new ApiError(payload?.message || 'Upload non configuré sur le serveur', {
      status: 503,
    });
  }
  if (!response.ok || !payload?.success || !payload.data?.url) {
    throw new ApiError(payload?.message || 'Impossible d’envoyer l’image', {
      status: response.status,
    });
  }

  return payload.data.url;
}
