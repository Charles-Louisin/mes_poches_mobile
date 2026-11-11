import { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { pollFeedbackInbox, registerFeedbackPushToken } from '@/lib/feedback-push';
import {
  flushDeferredNotification,
  hrefFromNotification,
  openFromNotification,
  resetNotificationSession,
} from '@/lib/notification-open';

function isInboxScreen(path: string): boolean {
  return path === '/feedback' || /\/admin-messages\/[a-f0-9]{24}/i.test(path);
}

export function FeedbackPushListener() {
  const { ready, token, user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || !token) return;
    void registerFeedbackPushToken({ request: true });
  }, [ready, token, user?.id]);

  // Une notification touchée avant la fin du chargement de la session est ouverte une fois connecté.
  useEffect(() => {
    if (ready && token) flushDeferredNotification();
    else resetNotificationSession();
  }, [ready, token]);

  useEffect(() => {
    if (!ready || !token || Platform.OS === 'web') return;
    let cancelled = false;

    const tick = async (silent: boolean) => {
      if (cancelled) return;
      try {
        await pollFeedbackInbox({ silent });
      } catch {
        /* réseau / session */
      }
    };

    void tick(isInboxScreen(pathname));
    const interval = setInterval(() => {
      void tick(isInboxScreen(pathname));
    }, 20000);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tick(isInboxScreen(pathname));
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      appSub.remove();
    };
  }, [ready, token, pathname]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const openUrl = (url: string | null | undefined) => {
      if (!url) return;
      openFromNotification(null, url);
    };

    void Linking.getInitialURL().then(openUrl);
    const linkSub = Linking.addEventListener('url', ({ url }) => openUrl(url));

    let Notifications: typeof import('expo-notifications');
    try {
      Notifications = require('expo-notifications') as typeof import('expo-notifications');
    } catch {
      return () => linkSub.remove();
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const go = (response: { notification: { request: { content: { data?: unknown } } } }) => {
      const data = response.notification.request.content.data as {
        type?: string;
        userId?: string;
        screen?: string;
        pendingId?: string;
      };
      if (hrefFromNotification(data)) {
        openFromNotification(data);
      }
    };

    void Notifications.getLastNotificationResponseAsync?.().then((response) => {
      if (!response) return;
      go(response);
      // Sinon la même notification rouvrirait la page à chaque lancement.
      void Notifications.clearLastNotificationResponseAsync?.();
    });

    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => {
      sub.remove();
      linkSub.remove();
    };
  }, []);

  return null;
}
