import { Platform } from 'react-native';
import { isNetworkFailure } from './errors';

type NetworkMod = {
  getNetworkStateAsync: () => Promise<{ isConnected?: boolean | null; isInternetReachable?: boolean | null }>;
  addNetworkStateListener: (listener: (state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void) => {
    remove: () => void;
  };
};

function networkMod(): NetworkMod | null {
  try {
    return require('expo-network') as NetworkMod;
  } catch {
    return null;
  }
}

export function isOnlineNow() {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export async function isOnline(): Promise<boolean> {
  const mod = networkMod();
  if (mod) {
    try {
      const state = await mod.getNetworkStateAsync();
      if (state.isInternetReachable === false) return false;
      if (state.isConnected === false) return false;
      return true;
    } catch {
      /* fallback */
    }
  }
  return isOnlineNow();
}

export function subscribeOnline(listener: (online: boolean) => void) {
  const mod = networkMod();
  if (mod) {
    const sub = mod.addNetworkStateListener((state) => {
      listener(!(state.isConnected === false || state.isInternetReachable === false));
    });
    return () => sub.remove();
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const on = () => listener(true);
    const off = () => listener(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }
  return () => undefined;
}

export function isNetworkError(err: unknown): boolean {
  return isNetworkFailure(err);
}
