import { router } from 'expo-router';
import { ApiError } from './errors';
import { getQueryClient } from './query';
import { clearToken, getToken } from './secure-token';
import { STORAGE_KEYS, remove } from './storage';

type SessionListener = (reason: 'expired' | 'logout') => void;

const listeners = new Set<SessionListener>();
let revoking = false;
let ignoreMissingToken = false;

export function onSessionChange(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginSilentAuth() {
  ignoreMissingToken = true;
}

export function endSilentAuth() {
  ignoreMissingToken = false;
}

export function isSessionError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'SESSION_REVOKED' || err.status === 401);
}

export async function revokeSession(reason: 'expired' | 'logout' = 'expired') {
  if (revoking) return;
  if (reason === 'expired' && ignoreMissingToken && !getToken()) return;
  revoking = true;
  try {
    await clearToken();
    await remove(STORAGE_KEYS.user);
    getQueryClient().clear();
    listeners.forEach((listener) => listener(reason));
    if (reason === 'expired') {
      router.replace('/(auth)/login');
    }
  } finally {
    revoking = false;
  }
}
