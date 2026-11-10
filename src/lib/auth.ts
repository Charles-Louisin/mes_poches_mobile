import { fetchAuthRaw, fetchPublic } from './api-client';
import { ApiError } from './errors';
import type { MeUser } from './api';
import { getDeviceTrust } from './device-trust';

export interface AuthPayload {
  user: MeUser;
  token: string;
  /** Jeton d'appareil approuvé (double authentification), à conserver. */
  deviceTrust?: string;
  /** Faux si l'identité avait déjà eu l'essai gratuit (compte recréé). */
  trialGranted?: boolean;
}

/** Données renvoyées quand la double authentification demande un code. */
export interface TwoFactorChallenge {
  challenge: string;
  emailHint: string;
  cooldownSeconds?: number;
}

export async function loginRequest(email: string, password: string): Promise<AuthPayload> {
  const trust = await getDeviceTrust();
  const { response, data } = await fetchAuthRaw('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: trust ? { 'X-Device-Trust': trust } : undefined,
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Connexion impossible', {
      code: data.code,
      status: response.status,
      data: data.data,
    });
  }
  return data.data as AuthPayload;
}

export async function registerRequest(email: string, password: string, name?: string) {
  const { response, data } = await fetchAuthRaw('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  const created =
    (response.ok && data.success) ||
    response.status >= 500 ||
    /erreur lors de l['’']inscription/i.test(data.message || '');
  if (created) {
    return {
      needsVerification: true as const,
      email: (data.data as { email: string } | undefined)?.email ?? email,
    };
  }
  throw new ApiError(data.message || 'Inscription impossible', {
    code: data.code,
    status: response.status,
  });
}

export async function verifyEmailRequest(email: string, code: string): Promise<AuthPayload> {
  const { response, data } = await fetchAuthRaw('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Code invalide', {
      code: data.code,
      status: response.status,
    });
  }
  return data.data as AuthPayload;
}

export async function resendCodeRequest(email: string): Promise<{ cooldownSeconds?: number }> {
  const { response, data } = await fetchAuthRaw('/auth/resend-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Envoi impossible', {
      code: data.code,
      status: response.status,
      data: data.data,
    });
  }
  return {};
}

export async function forgotPasswordRequest(email: string): Promise<{ cooldownSeconds?: number }> {
  const { response, data } = await fetchAuthRaw('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Envoi impossible', {
      code: data.code,
      status: response.status,
      data: data.data,
    });
  }
  return {};
}

export async function resetPasswordRequest(
  email: string,
  code: string,
  password: string
): Promise<AuthPayload> {
  const { response, data } = await fetchAuthRaw('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Réinitialisation impossible', {
      code: data.code,
      status: response.status,
    });
  }
  return data.data as AuthPayload;
}

export async function checkRegisterAvailability(params: { email?: string; name?: string }) {
  const qs = new URLSearchParams();
  if (params.email?.trim()) qs.set('email', params.email.trim());
  if (params.name?.trim()) qs.set('name', params.name.trim());
  return fetchPublic<{
    email?: { available: boolean };
    name?: { available: boolean };
  }>(`/auth/check-availability?${qs.toString()}`);
}

export async function twoFactorLoginRequest(challenge: string, code: string, trustDevice: boolean): Promise<AuthPayload> {
  const { response, data } = await fetchAuthRaw('/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ challenge, code, trustDevice }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Code invalide', { code: data.code, status: response.status });
  }
  return data.data as AuthPayload;
}

export async function twoFactorResendRequest(challenge: string): Promise<{ cooldownSeconds?: number }> {
  const { response, data } = await fetchAuthRaw('/auth/login/2fa/resend', {
    method: 'POST',
    body: JSON.stringify({ challenge }),
  });
  if (!response.ok || !data.success) {
    throw new ApiError(data.message || 'Envoi impossible', { code: data.code, status: response.status });
  }
  return (data.data as { cooldownSeconds?: number }) ?? {};
}
