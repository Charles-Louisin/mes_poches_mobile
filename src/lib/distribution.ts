import { Platform } from 'react-native';
import { getDistribution } from 'sms-monitor';

/**
 * Build Google Play ? Le binaire le sait (meta-data écrite à la compilation), ce qui reste vrai
 * même après une mise à jour OTA publiée sans la variable d'environnement.
 *
 * Sur Google Play : pas de mise à jour par APK, pas de paiement hors Google Play Billing.
 */
export function isPlayBuild(): boolean {
  if (process.env.EXPO_PUBLIC_DISTRIBUTION === 'play') return true;
  if (Platform.OS !== 'android') return false;
  return getDistribution() === 'play';
}
