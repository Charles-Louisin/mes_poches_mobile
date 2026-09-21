import { showTransactionReady } from 'sms-monitor';
import { canUseSmsNative } from './sms-monitor';

export async function notifyTransactionReady(message: string): Promise<void> {
  if (!canUseSmsNative()) return;
  try {
    await showTransactionReady(message);
  } catch {
    /* Expo Go / module absent */
  }
}
