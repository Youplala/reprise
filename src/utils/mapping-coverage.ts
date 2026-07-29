import type { Snapshot, SquareBounds } from '@/data/snapshot';
import type { Coordinate, StationSummary } from '@/types/station';

export type MappingStatus = 'to-reprise' | 'published-reprise' | 'collection-2022';
export type MapFilter = 'all' | MappingStatus;

export type MappingCoverage = {
  /** Vues de 1970 réellement numérisées, et non le nombre d'éléments de l'API. */
  total1970: number;
  published1970: number;
  remaining1970: number;
  collection2022: number;
  squares: number;
  squaresOpened: number;
  /** Part des vues de 1970 refaites. C'est le sens littéral de « tout a été refait ». */
  percentage: number;
  /** Part des carrés ouverts au moins une fois. C'est ce que colorie la carte. */
  squarePercentage: number;
};

export type CoverageCell = {
  id: string;
  name: string;
  center: Coordinate;
  /** Ordre attendu par les consommateurs : sud-ouest, nord-ouest, nord-est, sud-est. */
  coordinates: Coordinate[];
  bounds: SquareBounds;
  approximateBounds?: boolean;
  total1970: number;
  published1970: number;
  remaining1970: number;
  collection2022: number;
  percentage: number;
};

export function mappingStatus(station: StationSummary): MappingStatus {
  if (station.kind === 'recapture-1970') return 'published-reprise';
  if (station.kind === 'station-2022') return 'collection-2022';
  return 'to-reprise';
}

export function stationMatchesFilter(station: StationSummary, filter: MapFilter) {
  return filter === 'all' || mappingStatus(station) === filter;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Les compteurs viennent du relevé, où ils sont calculés une fois sur la donnée complète.
 *
 * Le dénominateur est le nombre de vues de 1970. L'ancien calcul additionnait les carrés de
 * grille et les reprises en pesant chaque carré pour une seule photo, alors qu'un carré en
 * contient 25,8 en moyenne, et comptait le numérateur dans son propre dénominateur : d'où un
 * taux affiché de 41 % sans rapport avec la réalité.
 */
export function buildCoverage(snapshot: Snapshot): MappingCoverage {
  const metrics = snapshot.metrics;
  return {
    total1970: metrics.archivePhotos1970,
    published1970: metrics.recapturesPublished,
    remaining1970: Math.max(0, metrics.archivePhotos1970 - metrics.recapturesPublished),
    collection2022: metrics.stations2022,
    squares: metrics.gridSquares,
    squaresOpened: metrics.squaresOpened,
    percentage: round1(metrics.coverageByPhoto * 100),
    squarePercentage: round1(metrics.coverageBySquare * 100),
  };
}

function cornersOf([west, south, east, north]: SquareBounds): Coordinate[] {
  return [
    { latitude: south, longitude: west },
    { latitude: north, longitude: west },
    { latitude: north, longitude: east },
    { latitude: south, longitude: east },
  ];
}

function containsCoordinate(
  [west, south, east, north]: SquareBounds,
  { latitude, longitude }: Coordinate,
) {
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

/**
 * La grille du concours de 1970 telle qu'elle existe vraiment : des mailles de 250 m issues du
 * GeoJSON officiel, et non une grille recalculée à la volée. L'ancienne version fabriquait des
 * cellules de 1,1 km de côté, soit vingt fois la surface d'un carré.
 */
export function buildCoverageGrid(snapshot: Snapshot, stations: StationSummary[]): CoverageCell[] {
  const stations2022 = stations.filter((station) => station.kind === 'station-2022');

  return snapshot.squares.map((square) => {
    const bounds = square.bounds;
    const collection2022 = stations2022.filter((station) =>
      containsCoordinate(bounds, station.coordinate),
    ).length;

    const published1970 = square.recaptureCount;
    const total1970 = square.photoCount;

    return {
      id: square.id,
      name: square.name,
      center: square.coordinate,
      coordinates: cornersOf(bounds),
      bounds,
      approximateBounds: square.approximateBounds,
      total1970,
      published1970,
      remaining1970: Math.max(0, total1970 - published1970),
      collection2022,
      percentage: total1970 ? Math.round((published1970 / total1970) * 100) : 0,
    };
  });
}

/** Cellules recoupant la zone visible, pour ne pas dessiner 1 171 polygones hors écran. */
export function cellsWithinViewport(cells: CoverageCell[], viewport: SquareBounds): CoverageCell[] {
  const [west, south, east, north] = viewport;
  return cells.filter(
    ({ bounds }) =>
      !(bounds[2] < west || bounds[0] > east || bounds[3] < south || bounds[1] > north),
  );
}
