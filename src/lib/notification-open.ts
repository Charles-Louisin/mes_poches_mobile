import { router } from 'expo-router';

export type NotificationOpenData = {
  type?: string;
  userId?: string;
  screen?: string;
};

export function openFromNotification(data?: NotificationOpenData | null, url?: string | null) {
  const href = hrefFromNotification(data, url);
  if (!href) return;
  router.push(href as never);
}

export function hrefFromNotification(
  data?: NotificationOpenData | null,
  url?: string | null
): string | null {
  const type = data?.type || '';
  if (type === 'pending' || data?.screen === 'pending') return '/pending';
  if (type === 'feedback-reply' || data?.screen === 'feedback') return '/feedback';
  if (type === 'feedback' && data?.userId) return `/admin-messages/${data.userId}`;

  const raw = url || '';
  if (/mespoches:\/\/pending/i.test(raw) || raw.endsWith('/pending')) return '/pending';
  if (/mespoches:\/\/feedback/i.test(raw) || /mespoches:\/\/feedback\b/i.test(raw) || raw.endsWith('/feedback')) {
    return '/feedback';
  }
  const admin = raw.match(/(?:mespoches:\/\/)?admin-messages\/([a-f0-9]{24})/i);
  if (admin?.[1]) return `/admin-messages/${admin[1]}`;
  return null;
}
