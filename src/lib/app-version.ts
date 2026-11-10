import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { fetchPublic } from './api-client';
import { getJson, setJson } from './storage';

/** Nouvelle version de l'APK (nouveau build), distincte des mises à jour OTA (expo-updates). */
export type AppVersionInfo = {
  latestVersion: string | null;
  minVersion: string | null;
  apkUrl: string;
  sizeMb: number | null;
  notes: string | null;
  publishedAt: string | null;
};

export type ApkUpdate = AppVersionInfo & { currentVersion: string; latestVersion: string; mandatory: boolean };

/** Lien direct stable : toujours l'APK de la dernière release (identique au site). */
export const DIRECT_APK_URL = 'https://github.com/Charles-Louisin/mespoches/releases/latest/download/MES.POCHES.apk';

const DISMISS_KEY = 'mp_apk_update_dismissed';
const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export function installedVersion(): string {
  return Constants.nativeAppVersion || Constants.expoConfig?.version || '0.0.0';
}

/** -1 si a < b, 0 si égal, 1 si a > b (format x.y.z). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

/** Nouvel APK disponible ? `force` ignore le report « Plus tard » (écran Réglages → Mise à jour). */
export async function checkApkUpdate(force = false): Promise<ApkUpdate | null> {
  if (Platform.OS !== 'android') return null;
  let info: AppVersionInfo;
  try {
    info = await fetchPublic<AppVersionInfo>('/app/version');
  } catch {
    return null;
  }
  const current = installedVersion();
  if (!info.latestVersion || compareVersions(current, info.latestVersion) >= 0) return null;
  const mandatory = !!info.minVersion && compareVersions(current, info.minVersion) < 0;
  if (!mandatory && !force) {
    const dismissed = await getJson<{ version: string; at: number }>(DISMISS_KEY);
    if (dismissed?.version === info.latestVersion && Date.now() - dismissed.at < REMIND_AFTER_MS) return null;
  }
  return { ...info, apkUrl: info.apkUrl || DIRECT_APK_URL, currentVersion: current, latestVersion: info.latestVersion, mandatory };
}

/** « Plus tard » : on reprévient dans 3 jours. */
export async function dismissApkUpdate(version: string): Promise<void> {
  await setJson(DISMISS_KEY, { version, at: Date.now() });
}
