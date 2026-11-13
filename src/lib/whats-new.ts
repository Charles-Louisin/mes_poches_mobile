import { compareVersions } from './app-version';

/**
 * Nouveautés par version : résumé (modal après installation) et visite guidée (coach).
 * Chaque étape du coach ouvre l'écran concerné et explique comment s'en servir.
 */
export type TourStep = {
  /** Écran ouvert pendant l'étape. */
  route: string;
  title: string;
  body: string;
};

export type Release = {
  version: string;
  highlights: { title: string; body: string }[];
  tour: TourStep[];
};

export const RELEASES: Record<string, Release> = {
  '1.2.0': {
    version: '1.2.0',
    highlights: [
      { title: 'Plusieurs poches en une saisie', body: 'Une fiche par poche, puis tout s’enregistre d’un coup.' },
      { title: 'Trier les propositions de l’IA', body: 'Déplacez une ligne d’une fiche à l’autre avant de valider.' },
      { title: 'Objectifs plus utiles', body: 'Vos poches couvrent un objectif ? L’app vous dit d’où prendre l’argent.' },
      { title: 'Dépenses futures réglables', body: 'Dès que la poche couvre le montant, réglez-la en un geste.' },
      { title: 'Catégories et analyses', body: 'Chaque catégorie a son historique, ses filtres et son export.' },
    ],
    tour: [
      {
        route: '/(tabs)/transactions/new',
        title: 'Une fiche par poche',
        body: 'Remplissez la poche, la catégorie et les lignes. Une autre poche ? « Ajouter une autre poche ». Touchez « Tout enregistrer » à la fin : au-delà de 3 fiches, l’enregistrement continue en arrière-plan avec sa progression en haut à droite.',
      },
      {
        route: '/pending',
        title: 'Trier avant de valider',
        body: 'Après un scan ou une dictée, « Trier et tout valider » ouvre l’atelier : « Déplacer » envoie une ligne dans une autre fiche, les totaux se recalculent, puis « Tout valider ».',
      },
      {
        route: '/objectifs',
        title: 'Budgets, épargne, récurrences',
        body: 'Touchez « i » à côté de chaque titre pour savoir à quoi il sert. Une carte se déplie d’un toucher : messages, conseils du mois et, si c’est possible, d’où prendre l’argent.',
      },
      {
        route: '/(tabs)/transactions',
        title: 'Dépenses futures',
        body: 'Dans « À venir », une dépense prévue affiche « Régler maintenant » dès que sa poche couvre le montant. Vous êtes aussi prévenu par notification.',
      },
      {
        route: '/(tabs)/categories',
        title: 'Catégories',
        body: 'Le « + » crée une catégorie. Touchez-en une pour voir son historique, filtrer par poche ou par mois, et l’exporter (forfait Business).',
      },
      {
        route: '/(tabs)/analytics',
        title: 'Analyse',
        body: 'Touchez une catégorie de sorties ou d’entrées : son historique du mois s’ouvre, avec le calcul du pourcentage expliqué.',
      },
      {
        route: '/(tabs)',
        title: 'C’est tout',
        body: 'Vous retrouverez cette visite dans Plus › « Nouveautés ». Un message en haut de l’écran se ferme en le glissant sur le côté.',
      },
    ],
  },
};

export function releaseFor(version: string): Release | null {
  return RELEASES[version] ?? null;
}

/** Dernière version décrite (pour rejouer la visite depuis le menu). */
export function latestRelease(): Release {
  const keys = Object.keys(RELEASES).sort((a, b) => compareVersions(b, a));
  return RELEASES[keys[0]];
}
