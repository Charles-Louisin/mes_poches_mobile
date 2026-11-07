import { getErrorMessage } from './errors';

export function formatScanError(e: unknown): string {
  const mapped = getErrorMessage(e, '');
  if (mapped) {
    const lower = mapped.toLowerCase();
    if (lower.includes('connexion') || lower.includes('quota') || lower.includes('analyse')) {
      return mapped;
    }
  }
  const raw = e instanceof Error ? e.message : 'Analyse impossible';
  const lower = raw.toLowerCase();
  if (lower.includes('413') || lower.includes('too large') || lower.includes('volumineux')) {
    return 'Image trop volumineuse. Rapprochez le reçu ou réessayez.';
  }
  if (raw.length > 120) {
    return 'Analyse impossible. Réessayez avec une photo plus nette.';
  }
  return getErrorMessage(e, 'Analyse impossible. Réessayez avec une photo plus nette.');
}
