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

export const NETWORK_ERROR_MESSAGE = 'Pas de connexion. Vérifiez Internet et réessayez.';

const NETWORK_RE =
  /unknownhost|unable to resolve host|no address associated with hostname|failed to connect|econnrefused|enotfound|eai_again|sockettimeout|network request failed|failed to fetch|fetch failed|load failed|networkerror|internet(?: is)? (?:unreachable|disconnected)|cleartext http traffic|javax\.net\.ssl|sslhandshake|connection (?:refused|reset|timed out)|timed out:|host is unresolved/i;

export function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return false;
  if (err instanceof ApiError && err.code === 'NETWORK') return true;
  return NETWORK_RE.test(err.message);
}

function looksTechnical(raw: string): boolean {
  return (
    raw.length > 140 ||
    /java\.|unknownhost|exception:|at com\.|stack|statuscode|http\s*\d{3}|econn|enotfound|undefined is not/i.test(
      raw
    )
  );
}

export function getErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  const raw =
    err instanceof ApiError && err.message
      ? err.message
      : err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : '';

  if (!raw.trim()) return fallback;
  if (isNetworkFailure(err) || NETWORK_RE.test(raw)) return NETWORK_ERROR_MESSAGE;
  if (/0\.50 in balance for audio|openrouter_credits|limit_source|insufficient.?quota|quota.?exceeded/i.test(raw)) {
    return 'Quota IA atteint. Réessayez dans quelques minutes.';
  }
  if (/model.*(not found|introuvable|does not exist)|no endpoints found/i.test(raw)) {
    return 'Service d’analyse momentanément indisponible. Réessayez.';
  }
  if (err instanceof ApiError && err.code === 'TIMEOUT') {
    return err.message;
  }
  if (err instanceof ApiError && err.message && !looksTechnical(err.message)) {
    return err.message;
  }
  if (looksTechnical(raw)) return fallback;
  return raw;
}
