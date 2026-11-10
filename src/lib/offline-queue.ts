import { flushNativeOfflineQueue } from 'sms-monitor';
import { pendingTransactionApi, transactionApi, type PendingTransaction, type TransactionInput, type TransferInput } from './api';
import { isNetworkError } from './network';
import { invalidateFinance } from './query';
import { STORAGE_KEYS, getJson, setJson } from './storage';

/**
 * L'app ne fonctionne plus hors ligne (un écran « Pas de connexion » s'affiche à la place).
 * Ce module ne fait plus que VIDER, à la reconnexion :
 *  - la file native des SMS/notifications captés sans réseau (aucune transaction détectée n'est perdue) ;
 *  - les saisies mises en attente par les anciennes versions de l'app (migration, rien n'est perdu à la mise à jour).
 */

type LegacyPreview = Partial<
  Pick<PendingTransaction, 'wallet_id' | 'category_id' | 'type' | 'amount' | 'description' | 'date'>
>;

type LegacyJob =
  | { id: string; kind: 'tx-income' | 'tx-expense'; data: TransactionInput; createdAt: number }
  | { id: string; kind: 'tx-transfer'; data: TransferInput; createdAt: number }
  | { id: string; kind: 'pending-sms'; data: { text: string }; preview: LegacyPreview; createdAt: number }
  | { id: string; kind: 'pending-notif'; data: { title: string; body: string }; preview: LegacyPreview; createdAt: number }
  | { id: string; kind: 'pending-ocr'; data: { text: string }; preview: LegacyPreview; createdAt: number }
  | { id: string; kind: 'pending-voice'; data: { text?: string }; preview: LegacyPreview; createdAt: number };

function refId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return (value as { _id?: string })._id || '';
}

/** Réapplique les corrections faites hors ligne sur la proposition créée côté serveur. */
async function applyPreviewPatch(created: PendingTransaction | PendingTransaction[] | null | undefined, preview: LegacyPreview) {
  const item = Array.isArray(created) ? created[0] : created;
  if (!item?._id) return;
  const patch: Record<string, unknown> = {};
  const walletId = refId(preview.wallet_id);
  const categoryId = refId(preview.category_id);
  if (walletId) patch.wallet_id = walletId;
  if (categoryId) patch.category_id = categoryId;
  if (preview.type) patch.type = preview.type;
  if (preview.amount && preview.amount > 0) patch.amount = preview.amount;
  if (preview.description) patch.description = preview.description;
  if (preview.date) patch.date = preview.date;
  if (Object.keys(patch).length) await pendingTransactionApi.update(item._id, patch);
}

async function processLegacyJob(job: LegacyJob) {
  switch (job.kind) {
    case 'tx-income':
      return transactionApi.createIncome(job.data);
    case 'tx-expense':
      return transactionApi.createExpense(job.data);
    case 'tx-transfer':
      return transactionApi.createTransfer(job.data);
    case 'pending-sms':
      return applyPreviewPatch(await pendingTransactionApi.parseSms(job.data.text), job.preview);
    case 'pending-notif':
      return applyPreviewPatch(await pendingTransactionApi.parseNotification(job.data.title, job.data.body), job.preview);
    case 'pending-ocr':
      return applyPreviewPatch(await pendingTransactionApi.voiceNote({ text: job.data.text }), job.preview);
    case 'pending-voice':
      if (job.data.text) return applyPreviewPatch(await pendingTransactionApi.voiceNote({ text: job.data.text }), job.preview);
      return undefined;
  }
}

let flushing = false;

/** À appeler quand le réseau revient (et au démarrage). */
export async function flushOfflineQueue(): Promise<{ synced: number; left: number }> {
  if (flushing) return { synced: 0, left: 0 };
  flushing = true;
  try {
    void flushNativeOfflineQueue();
    const jobs = (await getJson<LegacyJob[]>(STORAGE_KEYS.offlineQueue)) ?? [];
    if (!jobs.length) return { synced: 0, left: 0 };
    const remaining: LegacyJob[] = [];
    let synced = 0;
    for (const job of jobs) {
      try {
        await processLegacyJob(job);
        synced += 1;
      } catch (err) {
        if (isNetworkError(err)) remaining.push(job);
      }
    }
    await setJson(STORAGE_KEYS.offlineQueue, remaining);
    if (synced > 0) await invalidateFinance();
    return { synced, left: remaining.length };
  } finally {
    flushing = false;
  }
}
