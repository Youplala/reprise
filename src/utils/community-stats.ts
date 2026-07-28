// Statistiques dérivées de l'instantané : elles alimentent les graphiques de l'app.
//
// Tout est calculé une seule fois au chargement du module. L'instantané ne bouge pas en cours
// de session, donc recalculer à chaque rendu ne servirait qu'à ralentir les écrans.

import { SNAPSHOT_SQUARES, SNAPSHOT_STATIONS } from '@/data/snapshot';

export type MonthlyActivity = {
  /** `2026-07` */
  month: string;
  /** « juil. » */
  label: string;
  count: number;
};

export type ArrondissementActivity = {
  /** `75020` */
  code: string;
  /** « 20e » */
  label: string;
  count: number;
};

export type SquareBucket = {
  key: 'untouched' | 'started' | 'halfway' | 'complete';
  label: string;
  count: number;
};

export type Contributor = {
  name: string;
  count: number;
};

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

const recaptures = SNAPSHOT_STATIONS.filter((station) => station.kind === 'recapture-1970');

/** Reprises publiées par mois, dans l'ordre chronologique. */
export const MONTHLY_ACTIVITY: MonthlyActivity[] = (() => {
  const counts = new Map<string, number>();

  for (const station of recaptures) {
    const month = station.recaptureDate?.slice(0, 7);
    if (!month) continue;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, count]) => ({
      month,
      label: monthFormat.format(new Date(`${month}-01T00:00:00`)).replace('.', ''),
      count,
    }));
})();

/** Nombre de reprises datées : le reste n'a pas de date renseignée par le contributeur. */
export const DATED_RECAPTURES = MONTHLY_ACTIVITY.reduce((total, entry) => total + entry.count, 0);

export const ARRONDISSEMENT_ACTIVITY: ArrondissementActivity[] = (() => {
  const counts = new Map<string, number>();

  for (const station of recaptures) {
    const code = station.arrondissement;
    if (!code || !/^750\d{2}$/.test(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([code, count]) => {
      const number = Number(code.slice(3));
      return { code, label: number === 1 ? '1er' : `${number}e`, count };
    })
    .sort((left, right) => right.count - left.count);
})();

/** Répartition des carrés selon leur avancement, pour lire la carte d'un coup d'œil. */
export const SQUARE_DISTRIBUTION: SquareBucket[] = (() => {
  const buckets: Record<SquareBucket['key'], number> = {
    untouched: 0,
    started: 0,
    halfway: 0,
    complete: 0,
  };

  for (const square of SNAPSHOT_SQUARES) {
    const ratio = square.photoCount ? square.recaptureCount / square.photoCount : 0;
    if (ratio <= 0) buckets.untouched += 1;
    else if (ratio < 0.25) buckets.started += 1;
    else if (ratio < 1) buckets.halfway += 1;
    else buckets.complete += 1;
  }

  return [
    { key: 'untouched', label: 'Aucune reprise', count: buckets.untouched },
    { key: 'started', label: 'Commencé', count: buckets.started },
    { key: 'halfway', label: 'Bien avancé', count: buckets.halfway },
    { key: 'complete', label: 'Terminé', count: buckets.complete },
  ];
})();

/**
 * Contributeurs les plus actifs. Le règlement de l'Observatoire prévoit explicitement le crédit
 * sous la forme « Prénom NOM » : ces noms sont publics et leur affichage est une obligation
 * d'attribution, pas une donnée personnelle exposée par erreur.
 */
export const TOP_CONTRIBUTORS: Contributor[] = (() => {
  // Les noms sont saisis à la main : « Martin de PRESSENSÉ » et « Martin DE PRESSENSÉ » sont la
  // même personne. On regroupe sans tenir compte de la casse, des accents ni des espaces
  // multiples, et on retient l'orthographe la plus fréquemment employée.
  const groups = new Map<string, { spellings: Map<string, number>; count: number }>();

  for (const station of recaptures) {
    const name = station.recaptureAuthor?.trim().replace(/\s+/g, ' ');
    if (!name) continue;

    const key = name
      .toLocaleLowerCase('fr-FR')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

    const group = groups.get(key) ?? { spellings: new Map<string, number>(), count: 0 };
    group.count += 1;
    group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ spellings, count }) => {
      const name = [...spellings.entries()].sort((left, right) => right[1] - left[1])[0][0];
      return { name, count };
    })
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'fr-FR'));
})();

export const CONTRIBUTOR_COUNT = TOP_CONTRIBUTORS.length;

const PARTICLES = new Set(['de', 'du', 'des', 'le', 'la', 'van', 'von', 'di', "d'"]);

/**
 * Uniformise la casse d'un nom saisi à la main. Le règlement de l'Observatoire crédite sous la
 * forme « Prénom NOM » : un « jean-yves Collet » au milieu d'un classement donne l'impression
 * d'une base mal tenue. Les particules restent en minuscules, les noms déjà en capitales sont
 * laissés tels quels.
 */
export function formatContributorName(name: string) {
  return name
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (PARTICLES.has(word.toLocaleLowerCase('fr-FR'))) return word.toLocaleLowerCase('fr-FR');
      if (word === word.toLocaleUpperCase('fr-FR')) return word;
      return word
        .split('-')
        .map((part) =>
          part ? part[0].toLocaleUpperCase('fr-FR') + part.slice(1).toLocaleLowerCase('fr-FR') : part,
        )
        .join('-');
    })
    .join(' ');
}

/** Reprises les plus récentes, pour le fil du collectif. */
export const RECENT_RECAPTURES = recaptures
  .filter((station) => station.recaptureDate && station.hasRecapture)
  .sort((left, right) => (right.recaptureDate ?? '').localeCompare(left.recaptureDate ?? ''));

/** Reprises publiées sur les 30 derniers jours du relevé. */
export const RECAPTURES_LAST_30_DAYS = (() => {
  const latest = RECENT_RECAPTURES[0]?.recaptureDate;
  if (!latest) return 0;

  const cutoff = new Date(`${latest}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  return RECENT_RECAPTURES.filter((station) => (station.recaptureDate ?? '') >= cutoffKey).length;
})();
