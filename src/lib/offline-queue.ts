import { listOfflineQueue, flushNativeOfflineQueue } from 'sms-monitor';
import {
  pendingTransactionApi,
  transactionApi,
  type PendingTransaction,
  type Transaction,
  type TransactionInput,
  type TransferInput,
} from './api';
import { isNetworkError, isOnline } from './network';
import { invalidateFinance } from './query';
import { parseMobileMoneySms, parseNotificationText } from './sms-parser';
import { STORAGE_KEYS, getJson, setJson } from './storage';

export type LocalPending = PendingTransaction & { local?: boolean };

export type OfflineJob =
  | { id: string; kind: 'tx-income'; data: TransactionInput; createdAt: number }
  | { id: string; kind: 'tx-expense'; data: TransactionInput; createdAt: number }
  | { id: string; kind: 'tx-transfer'; data: TransferInput; createdAt: number }
  | { id: string; kind: 'pending-sms'; data: { text: string }; preview: LocalPending; createdAt: number }
  | { id: string; kind: 'pending-notif'; data: { title: string; body: string }; preview: LocalPending; createdAt: number }
  | {
      id: string;
      kind: 'pending-voice';
      data: { text?: string; audio?: string; mimeType?: string };
      preview: LocalPending;
      createdAt: number;
    }
  | {
      id: string;
      kind: 'pending-ocr';
      data: { text: string };
      preview: LocalPending;
      createdAt: number;
    };

function newId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeLocalPending(partial: Partial<LocalPending> & Pick<LocalPending, 'source' | 'type' | 'amount' | 'description'>): LocalPending {
  const now = new Date().toISOString();
  return {
    _id: newId(),
    status: 'pending',
    operator: 'unknown',
    counterparty: '',
    date: now.slice(0, 10),
    raw_text: '',
    confidence: 0.6,
    created_at: now,
    local: true,
    ...partial,
  };
}

export async function getOfflineJobs(): Promise<OfflineJob[]> {
  return (await getJson<OfflineJob[]>(STORAGE_KEYS.offlineQueue)) ?? [];
}

async function saveJobs(jobs: OfflineJob[]) {
  await setJson(STORAGE_KEYS.offlineQueue, jobs);
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export async function enqueueJob(job: DistributiveOmit<OfflineJob, 'id' | 'createdAt'>): Promise<OfflineJob> {
  const next = { ...job, id: newId(), createdAt: Date.now() } as OfflineJob;
  const jobs = await getOfflineJobs();
  jobs.push(next);
  await saveJobs(jobs);
  return next;
}

export async function localTransactions(): Promise<Transaction[]> {
  const jobs = await getOfflineJobs();
  return jobs
    .filter((job) => job.kind === 'tx-income' || job.kind === 'tx-expense' || job.kind === 'tx-transfer')
    .map((job) => {
      const data = job.data as TransactionInput & TransferInput;
      return {
        _id: job.id,
        type: job.kind === 'tx-income' ? 'income' : job.kind === 'tx-expense' ? 'expense' : 'transfer',
        amount: data.amount,
        wallet_id: data.wallet_id ?? null,
        destination_wallet_id: 'destination_wallet_id' in data ? data.destination_wallet_id : undefined,
        category_id: 'category_id' in data ? data.category_id : undefined,
        description: `${data.description || 'Transaction'} · hors ligne`,
        date: data.date || new Date().toISOString(),
        balance_before: 0,
        balance_after: 0,
        created_at: new Date(job.createdAt).toISOString(),
      } satisfies Transaction;
    });
}

type PendingPatch = Partial<
  Pick<LocalPending, 'wallet_id' | 'category_id' | 'type' | 'amount' | 'description' | 'date'>
>;

function isCaptureJob(
  job: OfflineJob
): job is Extract<OfflineJob, { preview: LocalPending }> {
  return (
    job.kind === 'pending-sms' ||
    job.kind === 'pending-notif' ||
    job.kind === 'pending-voice' ||
    job.kind === 'pending-ocr'
  );
}

export async function localPendings(): Promise<LocalPending[]> {
  const jobs = await getOfflineJobs();
  const fromJobs = jobs.filter(isCaptureJob).map((job) => ({
    ...job.preview,
    _id: job.id,
    local: true,
  }));
  const native = await nativeQueuedPendings();
  const seen = new Set(fromJobs.map((item) => (item.raw_text || '').trim()));
  return [...fromJobs, ...native.filter((item) => !seen.has((item.raw_text || '').trim()))];
}

export async function enqueueSmsCapture(text: string): Promise<LocalPending> {
  const parsed = parseMobileMoneySms(text);
  if (!parsed) {
    throw new Error('SMS non reconnu comme transaction financière');
  }
  const preview = makeLocalPending({
    source: 'sms',
    type: parsed.type,
    amount: parsed.amount,
    description: parsed.description,
    operator: parsed.operator,
    counterparty: parsed.counterparty,
    raw_text: text,
    date: parsed.date.toISOString().slice(0, 10),
    confidence: parsed.confidence,
    pattern: parsed.pattern,
  });
  const job = await enqueueJob({ kind: 'pending-sms', data: { text }, preview });
  return { ...preview, _id: job.id, local: true };
}

export async function patchLocalPending(id: string, patch: PendingPatch): Promise<void> {
  if (id.startsWith('native-')) {
    const map = (await getJson<Record<string, PendingPatch>>(STORAGE_KEYS.nativePendingPatches)) ?? {};
    map[id] = { ...map[id], ...patch };
    await setJson(STORAGE_KEYS.nativePendingPatches, map);
    return;
  }
  const jobs = await getOfflineJobs();
  const next = jobs.map((job) => {
    if (job.id !== id || !isCaptureJob(job)) return job;
    return { ...job, preview: { ...job.preview, ...patch } };
  });
  await saveJobs(next);
}

function refId(value: LocalPending['wallet_id'] | LocalPending['category_id']): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || '';
}

async function applyPreviewPatch(
  created: PendingTransaction | PendingTransaction[] | null | undefined,
  preview: LocalPending
): Promise<void> {
  const item = Array.isArray(created) ? created[0] : created;
  if (!item?._id) return;
  const walletId = refId(preview.wallet_id);
  const categoryId = refId(preview.category_id);
  const patch: {
    wallet_id?: string;
    category_id?: string | null;
    type?: 'income' | 'expense';
    amount?: number;
    description?: string;
    date?: string;
  } = {};
  if (walletId) patch.wallet_id = walletId;
  if (categoryId) patch.category_id = categoryId;
  else if (preview.category_id === null) patch.category_id = null;
  if (preview.type) patch.type = preview.type;
  if (preview.amount > 0) patch.amount = preview.amount;
  if (preview.description) patch.description = preview.description;
  if (preview.date) patch.date = preview.date;
  if (Object.keys(patch).length === 0) return;
  await pendingTransactionApi.update(item._id, patch);
}

async function nativeQueuedPendings(): Promise<LocalPending[]> {
  try {
    const items = await listOfflineQueue();
    const patches =
      (await getJson<Record<string, PendingPatch>>(STORAGE_KEYS.nativePendingPatches)) ?? {};
    const out: LocalPending[] = [];
    for (const item of items) {
      let payload: { text?: string; title?: string; body?: string } = {};
      try {
        payload = JSON.parse(item.json || '{}') as typeof payload;
      } catch {
        continue;
      }
      const raw = (payload.text || [payload.title, payload.body].filter(Boolean).join('\n')).trim();
      if (!raw) continue;
      const parsed = payload.text
        ? parseMobileMoneySms(payload.text)
        : parseNotificationText(payload.title || '', payload.body || '');
      if (!parsed) continue;
      const id = `native-${item.fingerprint || raw.slice(0, 24)}`;
      out.push({
        ...makeLocalPending({
          source: payload.text ? 'sms' : 'notification',
          type: parsed.type,
          amount: parsed.amount,
          description: parsed.description,
          operator: parsed.operator,
          counterparty: parsed.counterparty,
          raw_text: raw,
          date: parsed.date.toISOString().slice(0, 10),
          confidence: parsed.confidence,
          pattern: parsed.pattern,
        }),
        _id: id,
        ...(patches[id] ?? {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function processJob(job: OfflineJob) {
  if (job.kind === 'tx-income') await transactionApi.createIncome(job.data);
  else if (job.kind === 'tx-expense') await transactionApi.createExpense(job.data);
  else if (job.kind === 'tx-transfer') await transactionApi.createTransfer(job.data);
  else if (job.kind === 'pending-sms') {
    const created = await pendingTransactionApi.parseSms(job.data.text);
    await applyPreviewPatch(created, job.preview);
  } else if (job.kind === 'pending-notif') {
    const created = await pendingTransactionApi.parseNotification(job.data.title, job.data.body);
    await applyPreviewPatch(created, job.preview);
  } else if (job.kind === 'pending-ocr') {
    const created = await pendingTransactionApi.voiceNote({ text: job.data.text });
    await applyPreviewPatch(created, job.preview);
  } else {
    const created = await pendingTransactionApi.voiceNote(job.data);
    await applyPreviewPatch(created, job.preview);
  }
}

let flushing = false;

export async function flushOfflineQueue(): Promise<{ synced: number; left: number }> {
  if (flushing) return { synced: 0, left: (await getOfflineJobs()).length };
  flushing = true;
  try {
    void flushNativeOfflineQueue();
    const jobs = await getOfflineJobs();
    const remaining: OfflineJob[] = [];
    let synced = 0;
    for (const job of jobs) {
      if (job.kind === 'pending-voice') continue;
      try {
        await processJob(job);
        synced += 1;
      } catch (err) {
        if (isNetworkError(err)) remaining.push(job);
      }
    }
    await saveJobs(remaining);
    if (synced > 0) await invalidateFinance();
    return { synced, left: remaining.length };
  } finally {
    flushing = false;
  }
}

export async function runOrQueue<T>(onlineFn: () => Promise<T>, enqueue: () => Promise<unknown>): Promise<{ online: true; value: T } | { online: false }> {
  const online = await isOnline();
  try {
    return { online: true, value: await onlineFn() };
  } catch (err) {
    if (online || !isNetworkError(err)) throw err;
    await enqueue();
    return { online: false };
  }
}
