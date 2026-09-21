import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS, getString, remove, setString } from './storage';

const EMAIL_KEY = 'mp_bio_email';
const PASS_KEY = 'mp_bio_password';
const FACE_KEY = `${STORAGE_KEYS.biometric}:face`;
const FINGER_KEY = `${STORAGE_KEYS.biometric}:fingerprint`;

type LocalAuth = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  supportedAuthenticationTypesAsync: () => Promise<number[]>;
  authenticateAsync: (options: {
    promptMessage: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  AuthenticationType: { FINGERPRINT: number; FACIAL_RECOGNITION: number; IRIS: number };
};

function localAuth(): LocalAuth | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-local-authentication') as LocalAuth;
  } catch {
    return null;
  }
}

export type BiometricKind = 'fingerprint' | 'face' | 'iris' | 'none';

export async function biometricAvailability(): Promise<{
  available: boolean;
  enrolled: boolean;
  kinds: BiometricKind[];
}> {
  const auth = localAuth();
  if (!auth) return { available: false, enrolled: false, kinds: [] };
  try {
    const [hardware, enrolled, types] = await Promise.all([
      auth.hasHardwareAsync(),
      auth.isEnrolledAsync(),
      auth.supportedAuthenticationTypesAsync(),
    ]);
    const kinds: BiometricKind[] = [];
    if (types.includes(auth.AuthenticationType.FINGERPRINT)) kinds.push('fingerprint');
    if (types.includes(auth.AuthenticationType.FACIAL_RECOGNITION)) kinds.push('face');
    if (types.includes(auth.AuthenticationType.IRIS)) kinds.push('iris');
    return { available: hardware && kinds.length > 0, enrolled, kinds };
  } catch {
    return { available: false, enrolled: false, kinds: [] };
  }
}

export function biometricLabel(kinds: BiometricKind[]) {
  if (kinds.includes('face') && kinds.includes('fingerprint')) return 'Face ID ou empreinte';
  if (kinds.includes('face')) return Platform.OS === 'ios' ? 'Face ID' : 'Reconnaissance faciale';
  if (kinds.includes('fingerprint')) return Platform.OS === 'ios' ? 'Touch ID' : 'Empreinte digitale';
  if (kinds.includes('iris')) return 'Iris';
  return 'Biométrie';
}

export function labelForKind(kind: 'face' | 'fingerprint') {
  if (kind === 'face') return Platform.OS === 'ios' ? 'Face ID' : 'Reconnaissance faciale';
  return Platform.OS === 'ios' ? 'Touch ID' : 'Empreinte digitale';
}

async function migrateLegacyFlag() {
  const legacy = await getString(STORAGE_KEYS.biometric);
  if (legacy !== '1') return;
  const avail = await biometricAvailability();
  if (avail.kinds.includes('face')) await setString(FACE_KEY, '1');
  if (avail.kinds.includes('fingerprint')) await setString(FINGER_KEY, '1');
  if (!avail.kinds.includes('face') && !avail.kinds.includes('fingerprint')) {
    await setString(FINGER_KEY, '1');
  }
  await remove(STORAGE_KEYS.biometric);
}

export async function isBiometricKindEnabled(kind: 'face' | 'fingerprint') {
  await migrateLegacyFlag();
  return (await getString(kind === 'face' ? FACE_KEY : FINGER_KEY)) === '1';
}

export async function isBiometricLoginEnabled() {
  const [face, finger] = await Promise.all([isBiometricKindEnabled('face'), isBiometricKindEnabled('fingerprint')]);
  return face || finger;
}

export async function getEnabledBiometricKinds(): Promise<Array<'face' | 'fingerprint'>> {
  const enabled: Array<'face' | 'fingerprint'> = [];
  if (await isBiometricKindEnabled('face')) enabled.push('face');
  if (await isBiometricKindEnabled('fingerprint')) enabled.push('fingerprint');
  return enabled;
}

export async function getStoredBiometricEmail() {
  if (Platform.OS === 'web') return null;
  try {
    return await SecureStore.getItemAsync(EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function storeBiometricCredentials(email: string, password: string) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(EMAIL_KEY, email.trim().toLowerCase());
  await SecureStore.setItemAsync(PASS_KEY, password);
}

export async function enableBiometricKind(kind: 'face' | 'fingerprint', email?: string, password?: string) {
  if (Platform.OS === 'web') throw new Error('Biométrie indisponible sur le web');
  if (email && password) await storeBiometricCredentials(email, password);
  await setString(kind === 'face' ? FACE_KEY : FINGER_KEY, '1');
}

export async function disableBiometricKind(kind: 'face' | 'fingerprint') {
  await remove(kind === 'face' ? FACE_KEY : FINGER_KEY);
  const stillOn = await isBiometricLoginEnabled();
  if (stillOn) return;
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    await SecureStore.deleteItemAsync(PASS_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Préférer enableBiometricKind */
export async function enableBiometricLogin(email?: string, password?: string) {
  const avail = await biometricAvailability();
  if (avail.kinds.includes('face')) await enableBiometricKind('face', email, password);
  if (avail.kinds.includes('fingerprint')) await enableBiometricKind('fingerprint', email, password);
  if (!avail.kinds.includes('face') && !avail.kinds.includes('fingerprint')) {
    await enableBiometricKind('fingerprint', email, password);
  }
}

/** @deprecated Préférer disableBiometricKind */
export async function disableBiometricLogin() {
  await disableBiometricKind('face');
  await disableBiometricKind('fingerprint');
}

export async function authenticateBiometric(prompt: string) {
  const auth = localAuth();
  if (!auth) return { success: false as const, error: 'unavailable' };
  try {
    const result = await auth.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    });
    return result.success ? { success: true as const } : { success: false as const, error: result.error ?? 'failed' };
  } catch {
    return { success: false as const, error: 'failed' };
  }
}

export async function readBiometricCredentials() {
  if (Platform.OS === 'web') return null;
  try {
    const [email, password] = await Promise.all([
      SecureStore.getItemAsync(EMAIL_KEY),
      SecureStore.getItemAsync(PASS_KEY),
    ]);
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
}
