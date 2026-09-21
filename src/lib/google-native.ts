import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { getWebUrl } from './api-config';
import { googleHandoffPollRequest, googleHandoffRequest } from './google-auth';
import { getToken } from './secure-token';
import { authApi } from './api';
import { getString, remove, setString } from './storage';
import type { AuthPayload } from './auth';

const NONCE_KEY = 'mp_oauth_client_nonce';

let handoffInFlight: Promise<AuthPayload> | null = null;

/** Deep link de retour après Google — scheme de l’APK. */
export function googleReturnPath(): string {
  if (Platform.OS === 'web') return Linking.createURL('auth/google');
  return 'mespoches://auth/google';
}

/** Démarre OAuth via le site (redirect_uri Google déjà enregistré), jamais Railway. */
function googleHandoffStartUrl(nonce: string, returnTo: string): string {
  return (
    `${getWebUrl()}/api/auth/google?mobile=1` +
    `&client_nonce=${encodeURIComponent(nonce)}` +
    `&return_to=${encodeURIComponent(returnTo)}`
  );
}

export async function createGoogleNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await setString(NONCE_KEY, nonce);
  return nonce;
}

export function parseGoogleHandoffCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code;
    if (typeof code !== 'string' || !code) return null;
    const path = `${parsed.hostname ?? ''}/${(parsed.path ?? '').replace(/^\//, '')}`.toLowerCase();
    if (path.includes('auth/google') || path.endsWith('/google') || parsed.hostname === 'auth') {
      return code;
    }
    return null;
  } catch {
    return null;
  }
}

function parseGoogleError(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const error = parsed.queryParams?.error;
    return typeof error === 'string' && error ? error : null;
  } catch {
    return null;
  }
}

function safeDismiss() {
  if (Platform.OS === 'android') return;
  try {
    WebBrowser.dismissAuthSession();
  } catch {
    /* dismissBrowser n’existe pas sur Android */
  }
}

async function consumeHandoff(loader: () => Promise<AuthPayload>): Promise<AuthPayload> {
  if (handoffInFlight) return handoffInFlight;
  handoffInFlight = (async () => {
    try {
      return await loader();
    } finally {
      await remove(NONCE_KEY);
      handoffInFlight = null;
    }
  })();
  return handoffInFlight;
}

function exchangeHandoff(code: string, nonce: string): Promise<AuthPayload> {
  return consumeHandoff(() => googleHandoffRequest(code, nonce));
}

async function sessionFromSavedToken(): Promise<AuthPayload | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const me = await authApi.me();
    return { user: me, token };
  } catch {
    return null;
  }
}

function listenForAppReturn(): { promise: Promise<string>; cancel: () => void } {
  let settled = false;
  let sub: { remove: () => void } | null = null;

  const promise = new Promise<string>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      sub?.remove();
      fn();
    };
    sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.includes('auth/google') && !url.startsWith('mespoches://')) return;
      safeDismiss();
      const err = parseGoogleError(url);
      if (err) {
        finish(() => reject(new Error(googleErrorMessage(err))));
        return;
      }
      if (parseGoogleHandoffCode(url)) {
        finish(() => resolve(url));
      }
    });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      sub?.remove();
    },
  };
}

function startHandoffPoll(nonce: string): { promise: Promise<AuthPayload>; cancel: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let appSub: { remove: () => void } | null = null;

  const promise = new Promise<AuthPayload>((resolve) => {
    const tick = async () => {
      if (stopped) return;
      try {
        const payload =
          (await googleHandoffPollRequest(nonce)) || (await sessionFromSavedToken());
        if (payload && !stopped) {
          stopped = true;
          if (timer) clearTimeout(timer);
          appSub?.remove();
          void remove(NONCE_KEY);
          resolve(payload);
          return;
        }
      } catch {
        /* retry */
      }
      if (stopped) return;
      timer = setTimeout(() => void tick(), 1400);
    };
    timer = setTimeout(() => void tick(), 600);
    appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tick();
    });
  });

  return {
    promise,
    cancel: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      appSub?.remove();
    },
  };
}

function googleErrorMessage(code: string): string {
  if (/impossible|exchange|token|google_/i.test(code)) {
    return 'Connexion Google impossible. Réessayez.';
  }
  return 'Connexion Google impossible';
}

function payloadFromReturnUrl(resultUrl: string, nonce: string): Promise<AuthPayload> {
  const err = parseGoogleError(resultUrl);
  if (err) {
    return Promise.reject(new Error(googleErrorMessage(err)));
  }
  const code = parseGoogleHandoffCode(resultUrl);
  if (!code) {
    return Promise.reject(new Error('Session Google invalide'));
  }
  return exchangeHandoff(code, nonce);
}

export async function startGoogleSignIn(): Promise<AuthPayload> {
  const nonce = await createGoogleNonce();
  const returnTo = googleReturnPath();
  const url = googleHandoffStartUrl(nonce, returnTo);

  try {
    await WebBrowser.warmUpAsync();
  } catch {
    /* Android sans Chrome Custom Tabs */
  }

  const inbound = listenForAppReturn();
  const poll = startHandoffPoll(nonce);
  const fromLink = inbound.promise.then((resultUrl) => payloadFromReturnUrl(resultUrl, nonce));

  try {
    return await new Promise<AuthPayload>((resolve, reject) => {
      let settled = false;
      let cancelTimer: ReturnType<typeof setTimeout> | undefined;
      const overall = setTimeout(() => {
        if (settled) return;
        void (async () => {
          const saved = await sessionFromSavedToken();
          if (settled) return;
          settled = true;
          inbound.cancel();
          poll.cancel();
          if (saved) {
            resolve(saved);
            return;
          }
          reject(new Error('Connexion Google trop longue. Réessayez.'));
        })();
      }, 120_000);

      const finish = (next: Promise<AuthPayload>) => {
        void next.then(
          (payload) => {
            if (settled) return;
            settled = true;
            if (cancelTimer) clearTimeout(cancelTimer);
            clearTimeout(overall);
            inbound.cancel();
            poll.cancel();
            resolve(payload);
          },
          (err) => {
            if (settled) return;
            const message = err instanceof Error ? err.message : '';
            if (
              /pas encore prête|trop longue|expiré|déjà utilisé|appareil non reconnu/i.test(
                message
              )
            ) {
              return;
            }
            settled = true;
            if (cancelTimer) clearTimeout(cancelTimer);
            clearTimeout(overall);
            inbound.cancel();
            poll.cancel();
            reject(err instanceof Error ? err : new Error('Connexion Google impossible'));
          }
        );
      };

      finish(fromLink);
      finish(poll.promise);

      void (async () => {
        try {
          const browser = await WebBrowser.openAuthSessionAsync(url, returnTo, {
            createTask: true,
            showInRecents: true,
          });
          if (settled) return;
          if (browser.type === 'success' && 'url' in browser && browser.url) {
            finish(payloadFromReturnUrl(browser.url, nonce));
            return;
          }
          if (browser.type === 'cancel' || browser.type === 'dismiss') {
            const saved = await sessionFromSavedToken();
            if (saved) {
              finish(Promise.resolve(saved));
              return;
            }
            cancelTimer = setTimeout(() => {
              if (settled) return;
              void sessionFromSavedToken().then((later) => {
                if (settled) return;
                if (later) {
                  finish(Promise.resolve(later));
                  return;
                }
                settled = true;
                clearTimeout(overall);
                inbound.cancel();
                poll.cancel();
                reject(new Error('Connexion Google annulée'));
              });
            }, 20_000);
          }
        } catch (err) {
          if (settled) return;
          finish(Promise.reject(err instanceof Error ? err : new Error('Connexion Google impossible')));
        }
      })();
    });
  } finally {
    inbound.cancel();
    poll.cancel();
    try {
      await WebBrowser.coolDownAsync();
    } catch {
      /* ignore */
    }
  }
}

export async function completeGoogleDeepLink(url: string): Promise<AuthPayload | null> {
  const code = parseGoogleHandoffCode(url);
  if (!code) return sessionFromSavedToken();
  const nonce = await getString(NONCE_KEY);
  if (!nonce) return sessionFromSavedToken();
  try {
    return await exchangeHandoff(code, nonce);
  } catch {
    return sessionFromSavedToken();
  }
}
