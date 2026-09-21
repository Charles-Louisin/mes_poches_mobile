import { ApiError } from './errors';
import { fetchAuthRaw, fetchPublic } from './api-client';
import { authApi, type MeUser } from './api';
import { saveToken } from './secure-token';
import type { AuthPayload } from './auth';

export async function googleClientIdRequest(): Promise<string | null> {
  try {
    const data = await fetchPublic<{ clientId?: string }>('/auth/google/client');
    return data.clientId?.trim() || null;
  } catch {
    return null;
  }
}

async function asAuthPayload(raw: unknown): Promise<AuthPayload> {
  const inner = raw as { user?: MeUser; token?: string } | null;
  if (!inner?.token) {
    throw new ApiError('Session Google invalide', { code: 'google_session' });
  }
  if (inner.user?.email) {
    return { user: inner.user, token: inner.token };
  }
  await saveToken(inner.token);
  const me = await authApi.me();
  return { user: me, token: inner.token };
}

export async function googleIdTokenRequest(idToken: string): Promise<AuthPayload> {
  const { response, data } = await fetchAuthRaw('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Connexion Google impossible', {
      code: data.code || 'google_failed',
      status: response.status,
    });
  }
  return asAuthPayload(data.data);
}

export async function googleHandoffRequest(code: string, clientNonce: string): Promise<AuthPayload> {
  const { response, data } = await fetchAuthRaw('/auth/google/handoff', {
    method: 'POST',
    body: JSON.stringify({ code, clientNonce }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Session Google invalide', {
      code: data.code || 'google_session',
      status: response.status,
    });
  }
  return asAuthPayload(data.data);
}

/** Session déjà créée côté serveur alors que le deep link n’est pas revenu à l’APK. */
export async function googleHandoffPollRequest(clientNonce: string): Promise<AuthPayload | null> {
  const { response, data } = await fetchAuthRaw('/auth/google/handoff-poll', {
    method: 'POST',
    body: JSON.stringify({ clientNonce }),
  });
  if (response.status === 202 || data.pending) return null;
  if (!response.ok || !data.success) return null;
  try {
    return await asAuthPayload(data.data);
  } catch {
    return null;
  }
}
