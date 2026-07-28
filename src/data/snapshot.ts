// Instantané local des données publiques de l'Observatoire, produit par
// `scripts/ingest-observatoire.mjs` et embarqué dans le bundle.
//
// L'API amont est servie par un Apache sans CDN, sans gzip et en `cache-control: private`.
// L'interroger au démarrage coûtait 4,5 Mo et une vingtaine de requêtes ; la lire ici coûte
// une lecture mémoire, fonctionne hors connexion, et ne dépend plus de la disponibilité d'un
// serveur associatif ni de la fin de campagne du 30 novembre 2026.
//
// Aucune adresse e-mail n'entre ici : le script filtre par liste blanche de champs et refuse
// d'écrire le fichier si une adresse survit.

import type { Coordinate } from '@/types/station';

type SnapshotStation = {
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

type SnapshotSquare = {
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

type Snapshot = {
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
const snapshot = require('../../assets/data/observatoire-snapshot.json') as Snapshot;

export const SNAPSHOT_VERSION = snapshot.version;
export const SNAPSHOT_SOURCE = snapshot.source;
export const SNAPSHOT_METRICS = snapshot.metrics;
export const SNAPSHOT_STATIONS = snapshot.stations;
export const SNAPSHOT_SQUARES = snapshot.squares;
export const GRID_SIDE_METRES = snapshot.grid.sideMetres;

/**
 * Reconstruit les permaliens ARK d'un carré. Ce sont des identifiants pérennes du portail des
 * bibliothèques spécialisées : on y renvoie, on ne rapatrie jamais les images (fonds BHVP sous
 * droit d'auteur des photographes, hors ODbL qui ne couvre que la base de données).
 */
export function archiveLinksOf(square: Pick<SnapshotSquare, 'refs'>): string[] {
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

const squaresById = new Map(SNAPSHOT_SQUARES.map((square) => [square.id, square]));
const stationsById = new Map(SNAPSHOT_STATIONS.map((station) => [station.id, station]));

export function findSnapshotSquare(id: string) {
  return squaresById.get(id);
}

export function findSnapshotStation(id: string) {
  return stationsById.get(id);
}

export type { SnapshotSquare, SnapshotStation };
