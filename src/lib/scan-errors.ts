export function formatScanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : 'Analyse impossible';
  const lower = raw.toLowerCase();
  if (/0\.50 in balance for audio|openrouter_credits|limit_source/i.test(raw)) {
    return 'La dictée audio passe par Whisper, qui exige un crédit IA. Réessayez, ou dictez via la reconnaissance vocale de l’appareil.';
  }
  if (lower.includes('413') || lower.includes('too large') || lower.includes('volumineux')) {
    return 'Image trop volumineuse. Rapprochez le reçu ou réessayez.';
  }
  if (
    lower.includes('model') &&
    (lower.includes('not found') || lower.includes('support') || lower.includes('introuvable'))
  ) {
    return 'Service IA temporairement indisponible. Réessayez dans quelques instants.';
  }
  if (lower.includes('quota') || lower.includes('429') || lower.includes('rate limit')) {
    return 'Quota IA atteint. Réessayez dans 1 à 2 minutes.';
  }
  if (raw.length > 120) {
    return 'Analyse impossible. Réessayez avec une photo plus nette.';
  }
  return raw;
}
