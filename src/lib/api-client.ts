import { getApiUrl } from './api-config';
import { getDeviceKey } from './device-key';
import { ApiError, isNetworkFailure, isTimeoutError, NETWORK_ERROR_MESSAGE, PremiumRequiredError } from './errors';
import { PREMIUM_REQUIRED_CODE } from './planLimits';
import { getToken, loadToken } from './secure-token';

/**
 * Jeton de session : en mémoire, sinon relu dans le stockage.
 * Au démarrage à froid (ou lien profond), un écran peut appeler l'API avant que la session soit
 * restaurée : sans cette relecture, l'utilisateur était déconnecté à tort.
 */
async function currentToken(): Promise<string | undefined> {
  return getToken() ?? (await loadToken());
}
import { revokeSession } from './session';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
  code?: string;
  needsVerification?: boolean;
  pending?: boolean;
}

function apiUrl(endpoint: string): string {
  return `${getApiUrl()}${endpoint}`;
}

function isAbortFailure(err: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true;
  return err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message));
}

function timeoutMsFor(url: string): number {
  if (/ai-scan|voice-note|briefing|transcri|parse-sms|parse-notification/i.test(url)) {
    return 90_000;
  }
  return 20_000;
}

async function request(url: string, options?: RequestInit): Promise<Response> {
  const timeoutMs = timeoutMsFor(url);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const upstream = options?.signal;
  const onUpstreamAbort = () => timeout.abort();
  if (upstream) {
    if (upstream.aborted) timeout.abort();
    else upstream.addEventListener('abort', onUpstreamAbort, { once: true });
  }
  try {
    const deviceKey = await getDeviceKey();
    const headers = new Headers(options?.headers);
    if (deviceKey && !headers.has('X-Device-Key')) headers.set('X-Device-Key', deviceKey);
    return await fetch(url, { ...options, headers, signal: timeout.signal });
  } catch (err) {
    if (isAbortFailure(err, timeout.signal) || isAbortFailure(err, upstream)) {
      if (upstream?.aborted) {
        const abort = new Error('Aborted');
        abort.name = 'AbortError';
        throw abort;
      }
      throw new ApiError('Le serveur met trop de temps à répondre. Réessayez.', {
        code: 'TIMEOUT',
      });
    }
    if (isNetworkFailure(err)) {
      throw new ApiError(NETWORK_ERROR_MESSAGE, {
        code: 'NETWORK',
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener('abort', onUpstreamAbort);
  }
}

async function parseBody(response: Response): Promise<ApiResponse<unknown> | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  return (await response.json()) as ApiResponse<unknown>;
}

function throwFrom(response: Response, data: ApiResponse<unknown> | null): never {
  if (response.status === 413) {
    throw new ApiError('Image trop volumineuse. Rapprochez le reçu ou réessayez.', {
      status: 413,
    });
  }
  const msg = data?.message || (response.status === 404 ? 'Route API introuvable' : `Erreur serveur (${response.status})`);
  if (data?.code === PREMIUM_REQUIRED_CODE) {
    throw new PremiumRequiredError(msg);
  }
  throw new ApiError(msg, {
    code: data?.code,
    status: response.status,
    data: data?.data,
  });
}

export async function fetchPublic<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await request(apiUrl(endpoint), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await parseBody(response);
  if (!response.ok || !data?.success) {
    throwFrom(response, data);
  }
  return data!.data as T;
}

export async function fetchAuthRaw(
  endpoint: string,
  options?: RequestInit
): Promise<{ response: Response; data: ApiResponse<unknown> }> {
  const response = await request(apiUrl(endpoint), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = (await parseBody(response)) ?? { success: false, message: 'Réponse invalide' };
  return { response, data };
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = await currentToken();
  if (!token) {
    void revokeSession('expired');
    throw new ApiError('Session expirée. Reconnectez-vous.', { code: 'SESSION_REVOKED', status: 401 });
  }

  const response = await request(apiUrl(endpoint), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    const data = await parseBody(response);
    if (response.status === 401) {
      void revokeSession('expired');
      throw new ApiError(data?.message || 'Session expirée. Reconnectez-vous.', {
        code: data?.code || 'SESSION_REVOKED',
        status: 401,
      });
    }
    if (data?.code === 'ACCOUNT_SUSPENDED') {
      void revokeSession('expired');
      throw new ApiError(data.message || 'Ce compte a été suspendu.', {
        code: 'ACCOUNT_SUSPENDED',
        status: 403,
      });
    }
    if (!data) {
      throwFrom(response, null);
    }
    if (!response.ok || !data.success) {
      throwFrom(response, data);
    }
  return data.data as T;
}

export async function fetchApiBlob(endpoint: string, options?: RequestInit): Promise<Blob> {
  const token = await currentToken();
  if (!token) {
    void revokeSession('expired');
    throw new ApiError('Session expirée. Reconnectez-vous.', { status: 401, code: 'SESSION_REVOKED' });
  }
  const response = await request(apiUrl(endpoint), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (response.status === 401) {
    void revokeSession('expired');
    throw new ApiError('Session expirée. Reconnectez-vous.', { status: 401, code: 'SESSION_REVOKED' });
  }
  if (!response.ok) {
    const data = await parseBody(response);
    throwFrom(response, data);
  }
  return response.blob();
}

export async function logoutRemote(): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await request(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    /* best effort */
  }
}
