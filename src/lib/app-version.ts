import { isPlayBuild } from './distribution';
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

/** Version déjà proposée automatiquement : on ne la propose plus jamais d'office. */
const SEEN_KEY = 'mp_apk_update_seen';
/** Téléchargement lancé : version visée et build installé à ce moment-là. */
const DOWNLOAD_KEY = 'mp_apk_download_started';
/** Release reconnue comme installée (le build a changé après le téléchargement). */
const INSTALLED_KEY = 'mp_apk_installed_release';

type Seen = { version: string; at: number };
type DownloadStarted = { version: string; build: string; at: number };

export function installedVersion(): string {
  return Constants.nativeAppVersion || Constants.expoConfig?.version || '0.0.0';
}

function installedBuild(): string {
  return String(Constants.nativeBuildVersion ?? '');
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

/**
 * Version réellement installée, telle qu'affichée sur la page de téléchargement.
 * Si l'APK téléchargé depuis une release annonce un numéro interne plus ancien, on retient la release.
 */
export async function effectiveVersion(): Promise<string> {
  const native = installedVersion();
  const ack = await getJson<{ version: string; build: string }>(INSTALLED_KEY);
  if (ack && ack.build === installedBuild() && compareVersions(ack.version, native) > 0) return ack.version;
  return native;
}

/**
 * Nouvel APK disponible ?
 * - `force` (écran « Rechercher une mise à jour ») : ignore le « déjà proposé ».
 * - Sans `force` : chaque version n'est proposée d'office qu'une seule fois (sauf mise à jour obligatoire).
 */
export async function checkApkUpdate(force = false): Promise<ApkUpdate | null> {
  // Google Play : mises à jour uniquement par le Store (règle « Abus de l'appareil et du réseau »).
  if (isPlayBuild()) return null;
  if (Platform.OS !== 'android') return null;
  let info: AppVersionInfo;
  try {
    info = await fetchPublic<AppVersionInfo>('/app/version');
  } catch {
    return null;
  }
  const latest = info.latestVersion;
  if (!latest) return null;

  // Téléchargement lancé pour cette release, puis nouveau build installé : c'est fait.
  const started = await getJson<DownloadStarted>(DOWNLOAD_KEY);
  if (started && started.version === latest && started.build !== installedBuild()) {
    await setJson(INSTALLED_KEY, { version: latest, build: installedBuild() });
  }

  const current = await effectiveVersion();
  if (compareVersions(current, latest) >= 0) return null;
  const mandatory = !!info.minVersion && compareVersions(current, info.minVersion) < 0;
  if (!mandatory && !force) {
    const seen = await getJson<Seen>(SEEN_KEY);
    if (seen?.version === latest) return null;
  }
  return { ...info, apkUrl: info.apkUrl || DIRECT_APK_URL, currentVersion: current, latestVersion: latest, mandatory };
}

/** La proposition automatique a été montrée : elle ne reviendra plus pour cette version. */
export async function markApkUpdateSeen(version: string): Promise<void> {
  await setJson(SEEN_KEY, { version, at: Date.now() });
}

/** Le téléchargement démarre : au prochain lancement sur un nouveau build, la release sera reconnue. */
export async function markApkDownloadStarted(version: string): Promise<void> {
  await setJson(DOWNLOAD_KEY, { version, build: installedBuild(), at: Date.now() });
  await markApkUpdateSeen(version);
}
