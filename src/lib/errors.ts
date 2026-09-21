import { PREMIUM_REQUIRED_CODE } from './planLimits';

export class ApiError extends Error {
  code?: string;
  status?: number;
  data?: unknown;

  constructor(message: string, opts?: { code?: string; status?: number; data?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.code = opts?.code;
    this.status = opts?.status;
    this.data = opts?.data;
  }
}

export class PremiumRequiredError extends ApiError {
  constructor(message: string) {
    super(message, { code: PREMIUM_REQUIRED_CODE, status: 403 });
    this.name = 'PremiumRequiredError';
  }
}

export function isPremiumRequiredError(err: unknown): err is PremiumRequiredError {
  return err instanceof PremiumRequiredError || (err instanceof ApiError && err.code === PREMIUM_REQUIRED_CODE);
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message === 'Aborted');
}

export function isTimeoutError(err: unknown): boolean {
  return (
    (err instanceof ApiError && err.code === 'TIMEOUT') ||
    (err instanceof Error && /trop de temps|délai dépassé/i.test(err.message))
  );
}

export function getErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  const raw =
    err instanceof ApiError && err.message
      ? err.message
      : err instanceof Error
        ? err.message
        : '';
  if (/0\.50 in balance for audio|openrouter_credits|limit_source/i.test(raw)) {
    return 'La dictée audio passe par Whisper (OpenRouter), qui exige au moins 0,50 $ de crédit — le scan et le briefing n’ont pas ce seuil. Rechargez OpenRouter, ou dictez via la reconnaissance vocale de l’appareil.';
  }
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && /failed to fetch|network request failed|load failed|networkerror/i.test(err.message)) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
