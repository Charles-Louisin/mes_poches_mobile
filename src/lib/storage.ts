import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  user: 'user_data',
  onboarding: 'onboarding_seen',
  currency: 'app_currency',
  setup: 'mp_setup_guide',
  pendingEmail: 'pending_verification_email',
  hideBalance: 'hide_balance',
  hideTrial: 'hide_trial',
  trialOffer: 'mp_trial_offer_seen',
  installPerms: 'mp_install_capture_perms',
  captureSetup: 'mp_capture_setup_v1',
  analyticsBriefing: 'mp_analytics_briefing',
  offlineQueue: 'mp_offline_queue',
  nativePendingPatches: 'mp_native_pending_patches',
  biometric: 'mp_biometric_login',
  inboxLastAt: 'mp_inbox_last_at',
  updateDismissedId: 'mp_update_dismissed_id',
} as const;

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getString(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

export async function setString(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function remove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
