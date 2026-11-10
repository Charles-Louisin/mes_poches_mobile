import { Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import {
  clearAuthToken,
  getNotificationListenerStatus,
  isNotificationListenerEnabled,
  isSmsMonitorAvailable,
  openAppDetailsSettings,
  openNotificationAccessSettings,
  rebindNotificationListener,
  storeAuthToken,
} from 'sms-monitor';
import { getApiUrl } from './api-config';
import { getString, remove, setString } from './storage';

const DECLINED_KEY = 'mp_capture_declined';

export function isAndroidNative(): boolean {
  return Platform.OS === 'android';
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function canUseSmsNative(): boolean {
  return isAndroidNative() && isSmsMonitorAvailable();
}

/** Lecture SMS / notifications : uniquement le build Play Store (profil EAS production). */
export function isMoneyCaptureEnabled(): boolean {
  return isAndroidNative() && process.env.EXPO_PUBLIC_MONEY_CAPTURE === 'true';
}

export function canUseMoneyCapture(): boolean {
  return canUseSmsNative() && isMoneyCaptureEnabled();
}

/**
 * Le service natif n'envoie des détections au serveur que s'il a un jeton.
 * Sans accès aux notifications (refusé, restreint ou retiré), on le lui retire :
 * la détection est alors réellement désactivée sur le téléphone, sans gêner le reste de l'app.
 */
export async function syncSmsMonitorToken(token: string | undefined): Promise<void> {
  if (!canUseSmsNative()) return;
  try {
    const granted = canUseMoneyCapture() && (await isNotificationListenerEnabled());
    if (!token || !granted) {
      await clearAuthToken();
      return;
    }
    await storeAuthToken(token, getApiUrl());
  } catch {
    /* Expo Go / module absent : la détection reste inactive */
  }
}

/** L'utilisateur a refusé (ou reporté) : on ne le relance plus et la détection reste coupée. */
export async function markCaptureDeclined(): Promise<void> {
  await setString(DECLINED_KEY, '1').catch(() => undefined);
  try {
    if (canUseSmsNative()) await clearAuthToken();
  } catch {
    /* rien */
  }
}

export async function isCaptureDeclined(): Promise<boolean> {
  return (await getString(DECLINED_KEY).catch(() => null)) === '1';
}

/** Accès accordé plus tard depuis les réglages : on réactive (jeton natif + plus de refus mémorisé). */
export async function onCaptureGranted(token: string | undefined): Promise<void> {
  await remove(DECLINED_KEY).catch(() => undefined);
  await syncSmsMonitorToken(token);
}

export async function checkNotificationListener(): Promise<boolean> {
  if (!canUseMoneyCapture()) return false;
  try {
    return await isNotificationListenerEnabled();
  } catch {
    return false;
  }
}

export async function getSmsListenerStatus(): Promise<{ enabled: boolean; connected: boolean }> {
  if (!canUseMoneyCapture()) return { enabled: false, connected: false };
  try {
    return await getNotificationListenerStatus();
  } catch {
    return { enabled: false, connected: false };
  }
}

export async function rebindSmsListener(): Promise<void> {
  if (!canUseMoneyCapture()) return;
  try {
    await rebindNotificationListener();
  } catch {
    /* module absent / process isolé pas encore prêt */
  }
}

export async function openRestrictedSettings(): Promise<void> {
  if (canUseSmsNative()) {
    if (await openAppDetailsSettings()) return;
  }
  if (!isAndroidNative()) return;
  await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
    data: 'package:com.mespoches.app',
  });
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!isMoneyCaptureEnabled()) return false;
  try {
    const rationale = {
      title: 'SMS Mobile Money',
      message:
        'Mes Poches lit uniquement les SMS de transfert d’argent pour proposer une transaction. L’app n’envoie aucun SMS.',
      buttonPositive: 'Continuer',
      buttonNegative: 'Plus tard',
    };
    const receive = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      rationale
    );
    const read = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      rationale
    );
    if (Number(Platform.Version) >= 33 && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
        title: 'Alertes Mes Poches',
        message: 'Pour vous prévenir quand une transaction Mobile Money est prête à valider.',
        buttonPositive: 'Continuer',
        buttonNegative: 'Plus tard',
      });
    }
    return receive === PermissionsAndroid.RESULTS.GRANTED && read === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Ouvre l'écran système d'accès aux notifications. false si aucun écran n'a pu s'ouvrir. Ne lève jamais. */
export async function openSmsNotificationSettings(): Promise<boolean> {
  if (!isMoneyCaptureEnabled()) return false;
  try {
    if (canUseSmsNative()) return await openNotificationAccessSettings();
    if (!isAndroidNative()) return false;
    await IntentLauncher.startActivityAsync('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS');
    return true;
  } catch {
    try {
      await openRestrictedSettings();
      return true;
    } catch {
      return false;
    }
  }
}
