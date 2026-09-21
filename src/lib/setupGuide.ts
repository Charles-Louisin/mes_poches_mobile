import { STORAGE_KEYS, getString, setString, remove } from './storage';

export type TutorialStep =
  | 'pocket-tab'
  | 'pocket-add'
  | 'pocket-name'
  | 'pocket-image'
  | 'pocket-balance'
  | 'pocket-submit'
  | 'category-tab'
  | 'category-name'
  | 'category-submit'
  | 'tour-home'
  | 'tour-transactions'
  | 'tour-wallets'
  | 'tour-analytics'
  | 'tour-plus'
  | 'success'
  | 'trial'
  | 'done'
  | null;

export type SetupStep = TutorialStep;

const LEGACY: Record<string, TutorialStep> = {
  wallet: 'pocket-tab',
  'nav-wallets': 'pocket-tab',
  'wallets-add': 'pocket-add',
  'wallet-form': 'pocket-name',
  category: 'category-tab',
  'nav-categories': 'category-tab',
  'categories-add': 'category-name',
  'category-form': 'category-name',
};

type SetupListener = () => void;
const listeners = new Set<SetupListener>();

export function subscribeSetup(listener: SetupListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitSetup() {
  listeners.forEach((listener) => listener());
}

function setupKey(userId: string) {
  return `${STORAGE_KEYS.setup}:${userId}`;
}

function trialKey(userId: string) {
  return `${STORAGE_KEYS.trialOffer}:${userId}`;
}

export async function getSetupStep(userId?: string | null): Promise<TutorialStep> {
  if (!userId) return null;
  const raw = await getString(setupKey(userId));
  if (!raw) return null;
  if (raw === 'done') return 'done';
  if (LEGACY[raw]) return LEGACY[raw];
  return raw as TutorialStep;
}

export async function setSetupStep(userId: string, step: TutorialStep): Promise<void> {
  if (!userId) return;
  if (!step || step === 'done') {
    await setString(setupKey(userId), 'done');
  } else {
    await setString(setupKey(userId), step);
  }
  emitSetup();
}

/** Démarre le coach pour ce compte. `force` relance même si un autre compte a déjà fini le tutoriel. */
export async function startSetupGuide(userId: string, force = false): Promise<void> {
  if (!userId) return;
  const current = await getSetupStep(userId);
  if (!force && (current === 'done' || current === 'trial' || current === 'success' || current)) return;
  await setSetupStep(userId, 'pocket-tab');
}

export async function clearSetupGuide(userId: string): Promise<void> {
  if (!userId) return;
  await remove(setupKey(userId));
  emitSetup();
}

export function isSetupActive(step: TutorialStep): boolean {
  return !!step && step !== 'done';
}

export async function getTrialOfferSeen(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  return (await getString(trialKey(userId))) === '1';
}

export async function setTrialOfferSeen(userId: string): Promise<void> {
  if (!userId) return;
  await setString(trialKey(userId), '1');
}
