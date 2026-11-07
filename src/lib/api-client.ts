import { getApiUrl } from './api-config';
import { ApiError, isNetworkFailure, isTimeoutError, NETWORK_ERROR_MESSAGE, PremiumRequiredError } from './errors';
import { readFinanceCache, writeFinanceCache } from './local-db';
import { isOnline } from './network';
import { PREMIUM_REQUIRED_CODE } from './planLimits';
import { getToken } from './secure-token';
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
    return await fetch(url, { ...options, signal: timeout.signal });
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

function persistFinanceSlice(endpoint: string, payload: unknown): void {
  const [path, query = ''] = endpoint.split('?');
  const params = new URLSearchParams(query);
  void (async () => {
    if (path === '/wallets') {
      await writeFinanceCache({ wallets: payload });
      return;
    }
    if (path === '/wallets/total-balance') {
      await writeFinanceCache({ totalBalance: payload });
      return;
    }
    if (path === '/categories') {
      const prev = await readFinanceCache();
      const incoming = Array.isArray(payload) ? payload : [];
      const existing = Array.isArray(prev?.categories) ? prev.categories : [];
      await writeFinanceCache({ categories: mergeById(existing, incoming) });
      return;
    }
    if (path === '/transactions') {
      if (params.get('wallet_id') || params.get('startDate') || params.get('endDate')) return;
      const prev = await readFinanceCache();
      const incoming = Array.isArray(payload) ? payload : [];
      const existing = Array.isArray(prev?.transactions) ? prev.transactions : [];
      const merged = mergeById(existing, incoming);
      await writeFinanceCache({ transactions: merged });
      return;
    }
    if (path === '/pending-transactions') {
      await writeFinanceCache({ pending: payload });
    }
  })();
}

function mergeById(existing: unknown[], incoming: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const item of existing) {
    const id = recordId(item);
    if (id) map.set(id, item);
  }
  for (const item of incoming) {
    const id = recordId(item);
    if (id) map.set(id, item);
  }
  return [...map.values()];
}

function recordId(item: unknown): string {
  if (item && typeof item === 'object' && '_id' in item) {
    return String((item as { _id: unknown })._id);
  }
  return '';
}

async function cachedFinanceSlice<T>(endpoint: string): Promise<T | undefined> {
  const [path, query = ''] = endpoint.split('?');
  const params = new URLSearchParams(query);
  const cache = await readFinanceCache();
  if (!cache) return undefined;
  if (path === '/wallets') return cache.wallets as T | undefined;
  if (path === '/wallets/total-balance') {
    if (cache.totalBalance !== undefined) return cache.totalBalance as T;
    if (Array.isArray(cache.wallets)) {
      const wallets = cache.wallets as Array<{ current_balance?: number }>;
      const total = wallets.reduce((sum, w) => sum + (Number(w.current_balance) || 0), 0);
      return { total, totalSavings: 0, wallets: cache.wallets } as T;
    }
    return undefined;
  }
  if (path === '/categories') {
    const list = cache.categories as Array<{ type?: string }> | undefined;
    if (!list) return undefined;
    const type = params.get('type');
    if (type) return list.filter((c) => c.type === type) as T;
    return list as T;
  }
  if (path === '/transactions') return cache.transactions as T | undefined;
  if (path === '/pending-transactions') return cache.pending as T | undefined;
  return undefined;
}

function canReadCache(err: unknown): boolean {
  return isNetworkFailure(err) || isTimeoutError(err);
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    void revokeSession('expired');
    throw new ApiError('Session expirée. Reconnectez-vous.', { code: 'SESSION_REVOKED', status: 401 });
  }

  const method = String(options?.method || 'GET').toUpperCase();
  if (method === 'GET' && !(await isOnline())) {
    const cached = await cachedFinanceSlice<T>(endpoint);
    if (cached !== undefined) return cached;
  }
  try {
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
    const payload = data.data as T;
    if (method === 'GET') persistFinanceSlice(endpoint, payload);
    return payload;
  } catch (err) {
    if (method === 'GET' && canReadCache(err)) {
      const cached = await cachedFinanceSlice<T>(endpoint);
      if (cached !== undefined) return cached;
    }
    throw err;
  }
}

export async function fetchApiBlob(endpoint: string, options?: RequestInit): Promise<Blob> {
  const token = getToken();
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
