import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { pendingTransactionApi } from '@/lib/api';

/** Intervalle de vérification quand l'app est ouverte (une requête légère : le nombre seulement). */
const POLL_MS = 15_000;

/**
 * Les propositions créées en arrière-plan (lecture des notifications, push du serveur) apparaissent
 * sans tirer pour rafraîchir : on surveille le nombre « À valider » et, s'il change, on recharge
 * l'accueil (bandeau) et la liste.
 */
export function PendingSync() {
  const { ready, token } = useAuth();
  const qc = useQueryClient();
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!ready || !token) {
      last.current = null;
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      try {
        const { count } = await pendingTransactionApi.getCount();
        if (cancelled) return;
        if (last.current !== null && count !== last.current) {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ['home'] }),
            qc.invalidateQueries({ queryKey: ['pending'] }),
          ]);
        }
        last.current = count;
      } catch {
        /* hors ligne / session : on réessaie au prochain tour */
      }
    };

    const start = () => {
      if (timer) return;
      void check();
      timer = setInterval(() => void check(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active' || Platform.OS === 'web') start();
    const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));

    // Push « Transaction à valider » reçue app ouverte : rafraîchit tout de suite.
    let notifSub: { remove: () => void } | null = null;
    if (Platform.OS !== 'web') {
      try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        notifSub = Notifications.addNotificationReceivedListener((n) => {
          const data = n.request.content.data as { type?: string } | undefined;
          if (data?.type === 'pending') void check();
        });
      } catch {
        /* module absent */
      }
    }

    return () => {
      cancelled = true;
      stop();
      sub.remove();
      notifSub?.remove();
    };
  }, [ready, token, qc]);

  return null;
}
