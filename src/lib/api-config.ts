import { isPlayBuild } from './distribution';
import { Platform } from 'react-native';

const PRODUCTION_API = 'https://mespochesbackend-production-dafd.up.railway.app/api';

function isLocalWebHost(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** Web localhost → proxy Metro (évite CORS). Native / prod → Railway. */
export function getApiUrl(): string {
  if (isLocalWebHost()) return '/__mp_api';
  return getPublicApiUrl();
}

/** URL absolue de l’API Express (OAuth navigateur, jamais le proxy Metro). */
export function getPublicApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return PRODUCTION_API;
}

export function getWebUrl(): string {
  return (process.env.EXPO_PUBLIC_WEB_URL || 'https://www.mespoches.store').replace(
    /\/$/,
    ''
  );
}

export function getPrivacyUrl(): string {
  return (
    process.env.EXPO_PUBLIC_PRIVACY_URL || `${getWebUrl()}/legal/privacy`
  );
}

export function isPaymentsEnabled(): boolean {
  // Google Play impose sa facturation pour les abonnements : pas de paiement SasPay dans ce build.
  if (isPlayBuild()) return false;
  return process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === 'true';
}
