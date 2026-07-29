// Instantané des données publiques de l'Observatoire, produit par
// `scripts/ingest-observatoire.mjs`.
//
// Une copie est embarquée dans le bundle : elle garantit que l'app fonctionne dès la première
// ouverture et hors connexion. Une version plus récente peut ensuite être téléchargée, ce qui
// évite de repasser par l'App Store pour un simple rafraîchissement de chiffres. Les
// contributions publiées avancent de vingt à soixante par jour pendant la campagne.
//
// Aucune adresse e-mail n'entre ici : le script filtre par liste blanche et refuse d'écrire si
// une adresse survit.

import type { Coordinate } from '@/types/station';

export type SnapshotStation = {
  id: string;
  name: string;
  coordinate: Coordinate;
  kind: 'recapture-1970' | 'station-2022';
  year: 1970 | 2022;
  approximate: boolean;
  arrondissement?: string;
  address?: string;
  description?: string;
  author?: string;
  recaptureAuthor?: string;
  dateLabel?: string;
  /** Date de la reprise contemporaine (`2026-07-28`), quand le contributeur l'a renseignée. */
  recaptureDate?: string;
  referenceImage?: string;
  recaptureImage?: string;
  hasRecapture: boolean;
  officialUrl: string;
};

/** `[ouest, sud, est, nord]` — la maille réelle de 250 m du concours de 1970. */
export type SquareBounds = [number, number, number, number];

export type SnapshotSquare = {
  id: string;
  name: string;
  coordinate: Coordinate;
  kind: 'archive-1970';
  year: 1970;
  approximate: boolean;
  sheet?: string;
  /** `[indexFonds, document, vues]` — `vues` est un compte si la série est séquentielle. */
  refs: [number, string, number | number[]][];
  photoCount: number;
  recaptureCount: number;
  officialUrl: string;
  bounds: SquareBounds;
  approximateBounds?: boolean;
};

export type SnapshotMetrics = {
  recapturesPublished: number;
  stations2022: number;
  gridSquares: number;
  squaresOpened: number;
  archivePhotos1970: number;
  coverageBySquare: number;
  coverageByPhoto: number;
  orphanRecaptures: number;
  offParis: number;
  squaresWithOfficialBounds: number;
};

export type Snapshot = {
  version: string;
  generatedAt: string;
  source: { url: string; name: string; operator: string; database: string; archiveRights: string };
  archive: { urlTemplate: string; viewPadding: number; fonds: string[] };
  grid: { source: string; sideMetres: number; boundsOrder: string[] };
  metrics: SnapshotMetrics;
  stations: SnapshotStation[];
  squares: SnapshotSquare[];
};

// `require` plutôt qu'un import : Metro inline le JSON en module, sans dépendre de
// `resolveJsonModule` côté TypeScript.
export const BUNDLED_SNAPSHOT = require('../../assets/data/observatoire-snapshot.json') as Snapshot;

/**
 * Vérifie qu'une charge utile téléchargée a bien la forme attendue avant de remplacer la copie
 * embarquée. Une réponse tronquée ou une page d'erreur ne doit jamais devenir la source de
 * vérité de l'application.
 */
export function isUsableSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Snapshot>;

  return (
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.stations) &&
    Array.isArray(candidate.squares) &&
    candidate.squares.length > 0 &&
    typeof candidate.metrics?.recapturesPublished === 'number' &&
    typeof candidate.archive?.urlTemplate === 'string' &&
    Array.isArray(candidate.archive?.fonds)
  );
}

/**
 * Reconstruit les permaliens ARK d'un carré. Ce sont des identifiants pérennes du portail des
 * bibliothèques spécialisées : on y renvoie, on ne rapatrie jamais les images (fonds BHVP sous
 * droit d'auteur des photographes, hors ODbL qui ne couvre que la base de données).
 */
export function archiveLinksOf(snapshot: Snapshot, square: Pick<SnapshotSquare, 'refs'>): string[] {
  const { urlTemplate, viewPadding, fonds } = snapshot.archive;
  const links: string[] = [];

  for (const [fondsIndex, document, views] of square.refs) {
    const fondsName = fonds[fondsIndex];
    if (!fondsName) continue;

    const list = Array.isArray(views)
      ? views
      : Array.from({ length: views }, (_, index) => index + 1);

    for (const view of list) {
      links.push(
        urlTemplate
          .replace('{fonds}', fondsName)
          .replace('{document}', document)
          .replace('{view}', String(view).padStart(viewPadding, '0')),
      );
    }
  }

  return links;
}
