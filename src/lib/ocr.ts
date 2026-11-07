import { Platform } from 'react-native';
import { recognizeText as nativeRecognize } from 'sms-monitor';
import { parseVoiceNote } from '@/lib/voice-parser';

export async function extractPrintedText(imageUri: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    return await nativeRecognize(imageUri);
  } catch {
    return null;
  }
}

/** Ticket imprimé : total + parser vocal de secours. */
export function parseReceiptText(text: string) {
  const total =
    text.match(/(?:total|montant|net\s+[aà]\s+payer|somme)\s*[:\-]?\s*(\d[\d\s.,]*)/i) ||
    text.match(/(\d{1,3}(?:[\s.,]\d{3})+|\d{3,})\s*(?:fcfa|xaf|f)?/i);
  const spoken = total ? `j'ai payé ${total[1]}` : text.replace(/\n/g, ' ');
  return parseVoiceNote(spoken.slice(0, 400));
}
