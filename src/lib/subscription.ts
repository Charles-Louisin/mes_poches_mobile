import { isPlayBuild } from './distribution';
import type { MeUser } from './api';
import { PREMIUM_REQUIRED_CODE } from './planLimits';

export { isPremiumRequiredError, PremiumRequiredError } from './errors';
export { PREMIUM_REQUIRED_CODE };

export function isPremiumUser(user: MeUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.isPremium) return true;
  const plan = user.plan ?? 'free';
  if (plan === 'premium') {
    if (!user.premiumUntil) return true;
    return new Date(user.premiumUntil) > new Date();
  }
  if (user.premiumUntil && new Date(user.premiumUntil) > new Date()) {
    return true;
  }
  return false;
}

export function isOnTrial(user: MeUser | null | undefined): boolean {
  if (!user || user.role === 'admin') return false;
  if (user.isOnTrial === true) return true;
  if (user.premiumSource !== 'trial') return false;
  return isPremiumUser(user);
}

export function getTrialDaysLeft(user: MeUser | null | undefined): number {
  if (!isOnTrial(user) || !user?.premiumUntil) return 0;
  const ms = new Date(user.premiumUntil).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function formatPremiumUntil(date: string | Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getUpgradePath(): string {
  return '/subscription';
}

export function isSubscriptionPaymentEnabled(): boolean {
  if (isPlayBuild()) return false;
  return process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === 'true';
}

const TIER_RANK = { free: 0, pro: 1, pro_plus: 2, business: 3 } as const;

/** Palier PAYÉ encore actif (hors essai) — même règle que le backend (activePaidTier). */
export function activePaidTier(
  user: { subscriptionTier?: keyof typeof TIER_RANK; accessTier?: keyof typeof TIER_RANK; premiumSource?: string | null; lifetime?: boolean } | null | undefined
): Exclude<keyof typeof TIER_RANK, 'free'> | null {
  const tier = user?.subscriptionTier;
  if (!tier || tier === 'free') return null;
  if (user?.lifetime) return tier;
  if (user?.premiumSource !== 'paid') return null;
  if (!user?.accessTier || user.accessTier === 'free') return null;
  return tier;
}

/** Un palier inférieur au forfait payé actif ne peut pas être acheté. */
export function isTierBelowActive(tier: keyof typeof TIER_RANK, active: keyof typeof TIER_RANK | null): boolean {
  return active != null && TIER_RANK[tier] < TIER_RANK[active];
}
