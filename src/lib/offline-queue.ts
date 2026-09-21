import {
  pendingTransactionApi,
  transactionApi,
  type PendingTransaction,
  type Transaction,
  type TransactionInput,
  type TransferInput,
} from './api';
import { isNetworkError } from './network';
import { invalidateFinance } from './query';
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

export async function enqueueJob(job: Omit<OfflineJob, 'id' | 'createdAt'>): Promise<OfflineJob> {
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

export async function localPendings(): Promise<LocalPending[]> {
  const jobs = await getOfflineJobs();
  return jobs
    .filter((job) => job.kind === 'pending-sms' || job.kind === 'pending-notif' || job.kind === 'pending-voice')
    .map((job) => ({ ...job.preview, _id: job.id, local: true }));
}

async function processJob(job: OfflineJob) {
  if (job.kind === 'tx-income') await transactionApi.createIncome(job.data);
  else if (job.kind === 'tx-expense') await transactionApi.createExpense(job.data);
  else if (job.kind === 'tx-transfer') await transactionApi.createTransfer(job.data);
  else if (job.kind === 'pending-sms') await pendingTransactionApi.parseSms(job.data.text);
  else if (job.kind === 'pending-notif') await pendingTransactionApi.parseNotification(job.data.title, job.data.body);
  else await pendingTransactionApi.voiceNote(job.data);
}

let flushing = false;

export async function flushOfflineQueue(): Promise<{ synced: number; left: number }> {
  if (flushing) return { synced: 0, left: (await getOfflineJobs()).length };
  flushing = true;
  try {
    const jobs = await getOfflineJobs();
    const remaining: OfflineJob[] = [];
    let synced = 0;
    for (const job of jobs) {
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
  try {
    return { online: true, value: await onlineFn() };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await enqueue();
    return { online: false };
  }
}
