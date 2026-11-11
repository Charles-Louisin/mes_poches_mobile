import { Platform } from 'react-native';
import { scheduleDailyReminder as scheduleNativeReminder } from 'sms-monitor';
import { canUseSmsNative } from './sms-monitor';

/** Rappel « enregistrez vos transactions » : chaque soir à 19 h. */
const REMINDER_HOUR = 19;
const REMINDER_ID = 'mp-daily-19h';
/** Anciens rappels programmés (20 h) à retirer pour ne pas doubler la notification. */
const LEGACY_IDS = ['mp-daily-20h'];

let ran = false;

export async function ensureDailyReminder(): Promise<void> {
  if (Platform.OS === 'web' || ran) return;
  ran = true;

  // Android : alarme native (survit au redémarrage, indique les transactions à valider).
  let native = false;
  if (canUseSmsNative()) {
    try {
      await scheduleNativeReminder();
      native = true;
    } catch {
      /* module absent : rappel expo ci-dessous */
    }
  }

  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      if (LEGACY_IDS.includes(n.identifier) || (native && n.identifier === REMINDER_ID)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    if (native) return;

    const current = await Notifications.getPermissionsAsync();
    if (!current.granted) return;
    await Notifications.setNotificationChannelAsync?.('mes_poches_reminders', {
      name: 'Rappels quotidiens',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    if (existing.some((n) => n.identifier === REMINDER_ID)) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: 'Pensez à Mes Poches',
        body: 'N’oubliez pas d’enregistrer vos transactions du jour.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: REMINDER_HOUR,
        minute: 0,
        channelId: 'mes_poches_reminders',
      },
    });
  } catch {
    /* expo-notifications optionnel */
  }
}
