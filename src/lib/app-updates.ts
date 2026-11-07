import * as Updates from 'expo-updates';

export type AppUpdateInfo = {
  available: boolean;
  updateId?: string;
  message?: string;
};

function manifestMessage(manifest: Updates.Manifest | undefined): string {
  if (!manifest) return '';
  const raw = manifest as Record<string, unknown>;
  const metadata = raw.metadata as { message?: string } | undefined;
  if (typeof metadata?.message === 'string' && metadata.message.trim()) return metadata.message.trim();
  const extra = raw.extra as { expoClient?: { extra?: { updateMessage?: string } } } | undefined;
  const fromExtra = extra?.expoClient?.extra?.updateMessage;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  return '';
}

function manifestId(manifest: Updates.Manifest | undefined): string | undefined {
  if (!manifest) return undefined;
  const raw = manifest as Record<string, unknown>;
  if (typeof raw.id === 'string') return raw.id;
  if (typeof raw.createdAt === 'string') return raw.createdAt;
  return undefined;
}

/** Les mises à jour Expo (EAS Update) ne s’appliquent pas en dev ni sans binaire de prod. */
export function otaUpdatesActive(): boolean {
  return !__DEV__ && Updates.isEnabled;
}

export function runningUpdateLabel(): string {
  if (!Updates.updateId) return 'Version embarquée';
  return Updates.updateId.slice(0, 8);
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  if (!otaUpdatesActive()) return { available: false };
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return { available: false };
    const manifest = result.manifest;
    return {
      available: true,
      updateId: manifestId(manifest),
      message: manifestMessage(manifest),
    };
  } catch {
    return { available: false };
  }
}

export async function downloadAppUpdate(): Promise<boolean> {
  if (!otaUpdatesActive()) return false;
  const result = await Updates.fetchUpdateAsync();
  return result.isNew;
}

export async function applyAppUpdate(): Promise<void> {
  await Updates.reloadAsync();
}

export function defaultUpdateMessage(custom?: string): string {
  if (custom?.trim()) return custom.trim();
  return 'Corrections et améliorations de l’application.';
}
