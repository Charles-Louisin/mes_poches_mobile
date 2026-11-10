import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Identifiant aléatoire propre à cette installation (aucune donnée matérielle).
 * Conservé après déconnexion ou suppression du compte : le serveur s'en sert, sous forme
 * d'empreinte, pour ne pas offrir deux fois l'essai gratuit sur le même téléphone.
 */
const KEY = 'mp_device_key';
let cached: string | null = null;

export async function getDeviceKey(): Promise<string | null> {
  if (cached) return cached;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      cached = localStorage.getItem(KEY);
      if (!cached) {
        cached = Crypto.randomUUID();
        localStorage.setItem(KEY, cached);
      }
      return cached;
    }
    cached = await SecureStore.getItemAsync(KEY);
    if (!cached) {
      cached = Crypto.randomUUID();
      await SecureStore.setItemAsync(KEY, cached);
    }
    return cached;
  } catch {
    return null;
  }
}
