import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mp_jwt';

let memoryToken: string | undefined;

function webStore() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export async function saveToken(token: string): Promise<void> {
  memoryToken = token;
  if (Platform.OS === 'web') {
    webStore()?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | undefined> {
  if (memoryToken) return memoryToken;
  if (Platform.OS === 'web') {
    memoryToken = webStore()?.getItem(TOKEN_KEY) ?? undefined;
    return memoryToken;
  }
  const value = await SecureStore.getItemAsync(TOKEN_KEY);
  memoryToken = value ?? undefined;
  return memoryToken;
}

export function getToken(): string | undefined {
  return memoryToken;
}

export async function clearToken(): Promise<void> {
  memoryToken = undefined;
  if (Platform.OS === 'web') {
    webStore()?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
