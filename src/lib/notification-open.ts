import { router } from 'expo-router';

export type NotificationOpenData = {
  type?: string;
  userId?: string;
  screen?: string;
  /** Proposition précise à ouvrir dans « À valider ». */
  pendingId?: string;
};

/**
 * Destination demandée par une notification, mise de côté tant que la session n'est pas prête.
 * Au démarrage à froid, la redirection vers l'accueil passerait sinon par-dessus.
 */
let deferredHref: string | null = null;
let sessionReady = false;

export function openFromNotification(data?: NotificationOpenData | null, url?: string | null) {
  const href = hrefFromNotification(data, url);
  if (!href) return;
  if (!sessionReady) {
    deferredHref = href;
    return;
  }
  router.navigate(href as never);
}

/** Appelé quand l'utilisateur est connecté et l'accueil monté : ouvre la destination en attente. */
export function flushDeferredNotification() {
  sessionReady = true;
  const href = deferredHref;
  deferredHref = null;
  if (!href) return;
  // Laisse la redirection initiale (accueil) se poser, puis empile la destination.
  setTimeout(() => router.navigate(href as never), 350);
}

export function resetNotificationSession() {
  sessionReady = false;
}

export function hrefFromNotification(
  data?: NotificationOpenData | null,
  url?: string | null
): string | null {
  const type = data?.type || '';
  if (type === 'pending' || data?.screen === 'pending') {
    return data?.pendingId && /^[a-f0-9]{24}$/i.test(data.pendingId) ? `/pending?id=${data.pendingId}` : '/pending';
  }
  if (type === 'feedback-reply' || data?.screen === 'feedback') return '/feedback';
  if (type === 'goal-ready' || data?.screen === 'objectifs') return '/objectifs';
  if (type === 'planned-funded' || type === 'batch-done' || data?.screen === 'transactions') return '/(tabs)/transactions';
  if (type === 'feedback' && data?.userId) return `/admin-messages/${data.userId}`;

  const raw = url || '';
  const pendingWithId = raw.match(/mespoches:\/\/pending\?id=([a-f0-9]{24})/i);
  if (pendingWithId?.[1]) return `/pending?id=${pendingWithId[1]}`;
  if (/mespoches:\/\/pending/i.test(raw) || raw.endsWith('/pending')) return '/pending';
  if (/mespoches:\/\/feedback\b/i.test(raw) || raw.endsWith('/feedback')) {
    return '/feedback';
  }
  const admin = raw.match(/(?:mespoches:\/\/)?admin-messages\/([a-f0-9]{24})/i);
  if (admin?.[1]) return `/admin-messages/${admin[1]}`;
  return null;
}
