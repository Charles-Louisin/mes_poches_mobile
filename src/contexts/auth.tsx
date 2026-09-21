import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { authApi, type MeUser, walletApi } from '@/lib/api';
import {
  loginRequest,
  registerRequest,
  resetPasswordRequest,
  verifyEmailRequest,
  type AuthPayload,
} from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { track } from '@/lib/telemetry';
import { logoutRemote } from '@/lib/api-client';
import { completeGoogleDeepLink, startGoogleSignIn } from '@/lib/google-native';
import { loadToken, saveToken, getToken } from '@/lib/secure-token';
import { startSetupGuide } from '@/lib/setupGuide';
import { beginSilentAuth, endSilentAuth, onSessionChange, revokeSession } from '@/lib/session';
import { syncSmsMonitorToken } from '@/lib/sms-monitor';
import { STORAGE_KEYS, getJson, getString, remove, setJson, setString } from '@/lib/storage';
import { isOnTrial, isPremiumUser } from '@/lib/subscription';

type AuthContextValue = {
  ready: boolean;
  token?: string;
  user: MeUser | null;
  onboardingSeen: boolean;
  pendingEmail: string | null;
  isPremium: boolean;
  isOnTrial: boolean;
  markOnboardingSeen: () => Promise<void>;
  captureSetupSeen: boolean;
  markCaptureSetupSeen: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeGoogleSession: (payload: AuthPayload) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  setPendingEmail: (email: string | null) => Promise<void>;
  refreshMe: () => Promise<MeUser | null>;
  logout: () => Promise<void>;
  requirePremium: (message?: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [user, setUser] = useState<MeUser | null>(null);
  const [onboardingSeen, setOnboardingSeen] = useState(false);
  const [captureSetupSeen, setCaptureSetupSeen] = useState(true);
  const [pendingEmail, setPendingEmailState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedToken, storedUser, seen, pending, capture] = await Promise.all([
        loadToken(),
        getJson<MeUser>(STORAGE_KEYS.user),
        getString(STORAGE_KEYS.onboarding),
        getString(STORAGE_KEYS.pendingEmail),
        getString(STORAGE_KEYS.captureSetup),
      ]);
      if (cancelled) return;
      setToken(storedToken);
      setUser(storedUser);
      setOnboardingSeen(seen === 'true');
      setCaptureSetupSeen(capture === 'true');
      setPendingEmailState(pending);
      if (storedToken) {
        await syncSmsMonitorToken(storedToken);
        void import('@/lib/daily-reminder').then((m) => m.ensureDailyReminder());
        try {
          const me = await authApi.me();
          if (!cancelled) {
            setUser(me);
            await setJson(STORAGE_KEYS.user, me);
          }
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.code === 'SESSION_REVOKED')) {
            await syncSmsMonitorToken(undefined);
            await revokeSession('expired');
            if (!cancelled) {
              setToken(undefined);
              setUser(null);
            }
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return onSessionChange(() => {
      setToken(undefined);
      setUser(null);
    });
  }, []);

  const persistSession = useCallback(async (payload: AuthPayload) => {
    await saveToken(payload.token);
    await setJson(STORAGE_KEYS.user, payload.user);
    await remove(STORAGE_KEYS.pendingEmail);
    setToken(payload.token);
    setUser(payload.user);
    setPendingEmailState(null);
    await syncSmsMonitorToken(payload.token);
    void import('@/lib/daily-reminder').then((m) => m.ensureDailyReminder());
  }, []);

  useEffect(() => {
    const apply = async (url: string) => {
      try {
        const payload = await completeGoogleDeepLink(url);
        if (!payload) return;
        await persistSession(payload);
        await maybeStartSetupIfEmpty(payload.user.id);
        router.replace('/(tabs)');
      } catch {
        /* nonce absent ou lien ignoré */
      }
    };
    const sub = Linking.addEventListener('url', ({ url }) => {
      void apply(url);
    });
    return () => sub.remove();
  }, [persistSession]);

  const markOnboardingSeen = useCallback(async () => {
    await setString(STORAGE_KEYS.onboarding, 'true');
    setOnboardingSeen(true);
  }, []);

  const markCaptureSetupSeen = useCallback(async () => {
    await setString(STORAGE_KEYS.captureSetup, 'true');
    setCaptureSetupSeen(true);
  }, []);

  const setPendingEmail = useCallback(async (email: string | null) => {
    if (!email) {
      await remove(STORAGE_KEYS.pendingEmail);
      setPendingEmailState(null);
      return;
    }
    await setString(STORAGE_KEYS.pendingEmail, email);
    setPendingEmailState(email);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await loginRequest(email.trim().toLowerCase(), password);
      await persistSession(payload);
      await maybeStartSetupIfEmpty(payload.user.id);
    },
    [persistSession]
  );

  const completeGoogleSession = useCallback(
    async (payload: AuthPayload) => {
      await persistSession(payload);
      await maybeStartSetupIfEmpty(payload.user.id);
    },
    [persistSession]
  );

  const loginWithGoogle = useCallback(async () => {
    try {
      const payload = await startGoogleSignIn();
      await completeGoogleSession(payload);
    } catch (err) {
      const existing = getToken();
      if (existing) {
        try {
          const me = await authApi.me();
          await completeGoogleSession({ user: me, token: existing });
          return;
        } catch {
          /* session parallèle absente */
        }
      }
      throw err;
    }
  }, [completeGoogleSession]);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await registerRequest(email.trim().toLowerCase(), password, name.trim());
      await setPendingEmail(result.email);
      return result;
    },
    [setPendingEmail]
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const payload = await verifyEmailRequest(email.trim().toLowerCase(), code);
      await persistSession(payload);
      await startSetupGuide(payload.user.id, true);
    },
    [persistSession]
  );

  const resetPassword = useCallback(
    async (email: string, code: string, password: string) => {
      const payload = await resetPasswordRequest(email.trim().toLowerCase(), code, password);
      await persistSession(payload);
    },
    [persistSession]
  );

  const refreshMe = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
    await setJson(STORAGE_KEYS.user, me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    beginSilentAuth();
    try {
      await logoutRemote();
      await syncSmsMonitorToken(undefined);
      await revokeSession('logout');
      setToken(undefined);
      setUser(null);
    } finally {
      endSilentAuth();
    }
  }, []);

  const requirePremium = useCallback((_message?: string) => {
    if (isPremiumUser(user)) return false;
    track('paywall', { screen: 'subscription', props: { element: 'require_premium' } });
    router.push('/subscription');
    return true;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      token,
      user,
      onboardingSeen,
      captureSetupSeen,
      pendingEmail,
      isPremium: isPremiumUser(user),
      isOnTrial: isOnTrial(user),
      markOnboardingSeen,
      markCaptureSetupSeen,
      login,
      loginWithGoogle,
      completeGoogleSession,
      register,
      verifyEmail,
      resetPassword,
      setPendingEmail,
      refreshMe,
      logout,
      requirePremium,
    }),
    [
      ready,
      token,
      user,
      onboardingSeen,
      captureSetupSeen,
      pendingEmail,
      markOnboardingSeen,
      markCaptureSetupSeen,
      login,
      loginWithGoogle,
      completeGoogleSession,
      register,
      verifyEmail,
      resetPassword,
      setPendingEmail,
      refreshMe,
      logout,
      requirePremium,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export async function maybeStartSetupIfEmpty(userId: string) {
  try {
    const wallets = await walletApi.getAll();
    if (wallets.length === 0) await startSetupGuide(userId, true);
  } catch {
    /* ignore */
  }
}
