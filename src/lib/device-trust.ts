import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Jeton « appareil approuvé » (double authentification) — 30 jours, renvoyé par le serveur. */
const KEY = 'mp_device_trust';

export async function getDeviceTrust(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveDeviceTrust(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, token);
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    /* sans stockage, un code sera simplement redemandé */
  }
}

export async function clearDeviceTrust(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* rien à faire */
  }
}
