import { requireOptionalNativeModule } from 'expo';

type SmsMonitorNative = {
  storeAuthToken(token: string, apiUrl?: string | null): Promise<void>;
  clearAuthToken(): Promise<void>;
  isNotificationListenerEnabled(): Promise<{ enabled: boolean }>;
  openNotificationAccessSettings(): Promise<void>;
  showTransactionReady(message: string): Promise<void>;
  saveToDownloads(sourcePath: string, filename: string, mimeType?: string | null): Promise<{ uri: string }>;
  scheduleDailyReminder(): Promise<void>;
  addListener?(
    event: string,
    listener: (payload: { alreadyValidated?: boolean }) => void
  ): { remove: () => void };
};

const native = requireOptionalNativeModule<SmsMonitorNative>('SmsMonitor');

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

export async function openNotificationAccessSettings(): Promise<void> {
  if (!native) return;
  await native.openNotificationAccessSettings();
}

export async function showTransactionReady(message: string): Promise<void> {
  if (!native) return;
  await native.showTransactionReady(message);
}

export async function scheduleDailyReminder(): Promise<void> {
  if (!native?.scheduleDailyReminder) return;
  await native.scheduleDailyReminder();
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
