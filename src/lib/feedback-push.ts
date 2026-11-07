import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  getNativeInboxCursor,
  scheduleInboxPoll,
  setNativeInboxCursor,
  touchNativeInboxHeartbeat,
} from 'sms-monitor';
import { feedbackApi } from './api';
import { STORAGE_KEYS, getString, setString } from './storage';

const CHANNEL = 'mes_poches_messages';

type InboxState = {
  role: 'admin' | 'user';
  unread: number;
  preview: string;
  userId: string;
  lastAt: string;
};

async function fetchInboxState(): Promise<InboxState> {
  try {
    return await feedbackApi.inboxPing();
  } catch {
    try {
      const threads = await feedbackApi.getThreads();
      const hot = threads.find((t) => t.unread > 0) ?? threads[0];
      const lastAt = hot?.lastAt ? new Date(hot.lastAt).toISOString() : '';
      return {
        role: 'admin',
        unread: threads.reduce((n, t) => n + (t.unread || 0), 0),
        preview: hot?.preview || '',
        userId: hot?.userId || '',
        lastAt,
      };
    } catch {
      const list = await feedbackApi.getMine();
      const lastAdmin = [...list].reverse().find((m) => m.from === 'admin');
      return {
        role: 'user',
        unread: lastAdmin ? 1 : 0,
        preview: lastAdmin?.body?.replace(/\s+/g, ' ').trim().slice(0, 120) || '',
        userId: lastAdmin?.user_id || '',
        lastAt: lastAdmin?.created_at ? new Date(lastAdmin.created_at).toISOString() : '',
      };
    }
  }
}

export async function ensureNotificationPermission(opts?: { request?: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && opts?.request) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return false;

    await Notifications.setNotificationChannelAsync?.(CHANNEL, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync?.('mes_poches_transactions', {
      name: 'Transactions détectées',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync?.('default', {
      name: 'Alertes',
      importance: Notifications.AndroidImportance.HIGH,
    });
    return true;
  } catch {
    return false;
  }
}

export async function registerFeedbackPushToken(opts?: { request?: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const granted = await ensureNotificationPermission(opts);
  if (!granted) return false;
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return false;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token.data) return false;
    await feedbackApi.registerPushToken(token.data);
    return true;
  } catch {
    return false;
  }
}

export async function markInboxSeen(lastAt?: string): Promise<void> {
  const at = lastAt || new Date().toISOString();
  await setString(STORAGE_KEYS.inboxLastAt, at);
  try {
    await setNativeInboxCursor(at);
  } catch {
    /* module natif optionnel */
  }
}

export async function pollFeedbackInbox(opts?: { silent?: boolean }): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await touchNativeInboxHeartbeat();
    await scheduleInboxPoll();
  } catch {
    /* module natif optionnel */
  }

  const ping = await fetchInboxState();
  const lastAt = ping.lastAt || '';
  let stored = '';
  try {
    stored = await getNativeInboxCursor();
  } catch {
    stored = '';
  }
  if (!stored) stored = (await getString(STORAGE_KEYS.inboxLastAt)) || '';

  if (ping.unread <= 0 || !lastAt) {
    if (lastAt && lastAt !== stored) await markInboxSeen(lastAt);
    return;
  }
  if (stored && lastAt <= stored) return;

  await markInboxSeen(lastAt);
  if (opts?.silent) return;

  const granted = await ensureNotificationPermission({ request: false });
  if (!granted) return;

  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  const admin = ping.role === 'admin';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: admin ? 'Nouveau message' : 'Réponse de Mes Poches',
      body:
        ping.preview ||
        (admin ? 'Un utilisateur vous a écrit.' : 'Vous avez un nouveau message.'),
      sound: 'default',
      channelId: CHANNEL,
      data: admin
        ? { type: 'feedback', userId: ping.userId }
        : { type: 'feedback-reply', screen: 'feedback' },
    },
    trigger: null,
  });
}
