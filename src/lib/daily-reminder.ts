import { Platform } from 'react-native';
import { scheduleDailyReminder as scheduleNativeReminder } from 'sms-monitor';
import { canUseSmsNative } from './sms-monitor';

export async function ensureDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (canUseSmsNative()) {
    try {
      await scheduleNativeReminder();
    } catch {
      /* module absent */
    }
  }
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const allowed = await Notifications.requestPermissionsAsync();
    if (!allowed.granted) return;
    await Notifications.setNotificationChannelAsync?.('mes_poches_reminders', {
      name: 'Rappels quotidiens',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const already = existing.some((n) => n.identifier === 'mp-daily-20h');
    if (already) return;
    await Notifications.scheduleNotificationAsync({
      identifier: 'mp-daily-20h',
      content: {
        title: 'Pensez à Mes Poches',
        body: 'N’oubliez pas d’enregistrer vos transactions du jour.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
  } catch {
    /* expo-notifications optionnel */
  }
}
