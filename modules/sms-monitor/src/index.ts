import { requireOptionalNativeModule } from 'expo';

type SmsMonitorNative = {
  getDistribution?(): string;
  storeAuthToken(token: string, apiUrl?: string | null): Promise<void>;
  clearAuthToken(): Promise<void>;
  isNotificationListenerEnabled(): Promise<{ enabled: boolean; connected?: boolean }>;
  rebindNotificationListener(): Promise<void>;
  openNotificationAccessSettings(): Promise<boolean | void>;
  openAppDetailsSettings(): Promise<boolean | void>;
  showTransactionReady(message: string): Promise<void>;
  saveToDownloads(sourcePath: string, filename: string, mimeType?: string | null): Promise<{ uri: string }>;
  listOfflineQueue(): Promise<Array<{ url?: string; json?: string; fingerprint?: string }>>;
  flushOfflineQueue(): Promise<void>;
  scheduleDailyReminder(): Promise<void>;
  scheduleInboxPoll(): Promise<void>;
  checkInboxNow(): Promise<void>;
  setInboxCursor(lastAt: string): Promise<void>;
  getInboxCursor(): Promise<{ lastAt?: string }>;
  touchInboxHeartbeat(): Promise<void>;
  trackBatchJob?(jobId: string): Promise<void>;
  stopBatchJob?(): Promise<void>;
  addListener?(
    event: string,
    listener: (payload: { alreadyValidated?: boolean }) => void
  ): { remove: () => void };
};

const native = requireOptionalNativeModule<SmsMonitorNative>('SmsMonitor');

/** « play » pour le build Google Play, « direct » pour l'APK du site (lu dans le manifeste). */
export function getDistribution(): 'play' | 'direct' | null {
  try {
    const value = native?.getDistribution?.();
    return value === 'play' ? 'play' : value === 'direct' ? 'direct' : null;
  } catch {
    return null;
  }
}

export function isSmsMonitorAvailable(): boolean {
  return native != null;
}

export async function storeAuthToken(token: string, apiUrl?: string): Promise<void> {
  if (!native) return;
  await native.storeAuthToken(token, apiUrl ?? null);
}

export async function clearAuthToken(): Promise<void> {
  if (!native) return;
  await native.clearAuthToken();
}

export async function isNotificationListenerEnabled(): Promise<boolean> {
  if (!native) return false;
  const status = await native.isNotificationListenerEnabled();
  return Boolean(status?.enabled);
}

export async function getNotificationListenerStatus(): Promise<{
  enabled: boolean;
  connected: boolean;
}> {
  if (!native) return { enabled: false, connected: false };
  const status = await native.isNotificationListenerEnabled();
  return {
    enabled: Boolean(status?.enabled),
    connected: Boolean(status?.connected),
  };
}

export async function rebindNotificationListener(): Promise<void> {
  if (!native?.rebindNotificationListener) return;
  try {
    await native.rebindNotificationListener();
  } catch {
    /* accès refusé ou restreint : rien à faire */
  }
}

/** true si un écran de réglages a pu s'ouvrir. Ne lève jamais. */
export async function openNotificationAccessSettings(): Promise<boolean> {
  if (!native?.openNotificationAccessSettings) return false;
  try {
    return (await native.openNotificationAccessSettings()) !== false;
  } catch {
    return false;
  }
}

export async function openAppDetailsSettings(): Promise<boolean> {
  if (!native?.openAppDetailsSettings) return false;
  try {
    return (await native.openAppDetailsSettings()) !== false;
  } catch {
    return false;
  }
}

export async function showTransactionReady(message: string): Promise<void> {
  if (!native) return;
  await native.showTransactionReady(message);
}

export async function scheduleDailyReminder(): Promise<void> {
  if (!native?.scheduleDailyReminder) return;
  await native.scheduleDailyReminder();
}

export async function scheduleInboxPoll(): Promise<void> {
  if (!native?.scheduleInboxPoll) return;
  await native.scheduleInboxPoll();
}

export async function checkNativeInboxNow(): Promise<void> {
  if (!native?.checkInboxNow) return;
  await native.checkInboxNow();
}

export async function setNativeInboxCursor(lastAt: string): Promise<void> {
  if (!native?.setInboxCursor) return;
  await native.setInboxCursor(lastAt);
}

export async function getNativeInboxCursor(): Promise<string> {
  if (!native?.getInboxCursor) return '';
  const result = await native.getInboxCursor();
  return result?.lastAt?.trim() ?? '';
}

export async function touchNativeInboxHeartbeat(): Promise<void> {
  if (!native?.touchInboxHeartbeat) return;
  await native.touchInboxHeartbeat();
}

export function subscribePendingDuplicate(
  listener: (alreadyValidated: boolean) => void
): () => void {
  if (!native?.addListener) return () => undefined;
  const sub = native.addListener('onPendingDuplicate', (payload) => {
    listener(Boolean(payload?.alreadyValidated));
  });
  return () => sub.remove();
}

export async function saveToDownloads(
  sourcePath: string,
  filename: string,
  mimeType?: string
): Promise<string | null> {
  if (!native?.saveToDownloads) return null;
  const result = await native.saveToDownloads(sourcePath, filename, mimeType ?? null);
  return result?.uri ?? null;
}

export async function listOfflineQueue(): Promise<
  Array<{ url?: string; json?: string; fingerprint?: string }>
> {
  if (!native?.listOfflineQueue) return [];
  const result = await native.listOfflineQueue();
  return Array.isArray(result) ? result : [];
}

export async function flushNativeOfflineQueue(): Promise<void> {
  if (!native?.flushOfflineQueue) return;
  await native.flushOfflineQueue();
}

/** Affiche la progression d'un enregistrement en lot dans les notifications (Android). */
export async function trackBatchJob(jobId: string): Promise<void> {
  try {
    await native?.trackBatchJob?.(jobId);
  } catch {
    /* module absent (web, Expo Go) : la progression reste visible dans l'app */
  }
}

export async function stopBatchJob(): Promise<void> {
  try {
    await native?.stopBatchJob?.();
  } catch {
    /* rien à arrêter */
  }
}
