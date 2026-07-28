// Accès aux données de l'Observatoire, lues dans l'instantané embarqué.
//
// Auparavant ce module appelait l'API amont à chaque ouverture : une requête pour la liste, puis
// jusqu'à dix-huit requêtes de détail pour trouver trois reprises à afficher dans le fil. Contre
// un serveur sans cache ni CDN, c'était lent, fragile, inutilisable hors connexion, et cela
// faisait porter la charge de tous les utilisateurs à l'hébergement d'une association.
//
// Tout est désormais synchrone : l'instantané est en mémoire, il n'y a plus rien à attendre.

import type { ImageSource } from 'expo-image';

import {
  archiveLinksOf,
  findSnapshotSquare,
  findSnapshotStation,
  SNAPSHOT_SQUARES,
  SNAPSHOT_STATIONS,
  type SnapshotSquare,
  type SnapshotStation,
} from '@/data/snapshot';
import type { StationDetail, StationSummary } from '@/types/station';

function imageSource(uri?: string): ImageSource | undefined {
  return uri ? { uri } : undefined;
}

function summaryFromStation(station: SnapshotStation): StationSummary {
  return {
    id: station.id,
    name: station.name,
    arrondissement: station.arrondissement,
    coordinate: station.coordinate,
    kind: station.kind,
    year: station.year,
    approximate: station.approximate,
    source: 'observatoire',
    previewImage: imageSource(station.referenceImage),
    frameCount: station.hasRecapture ? 2 : 1,
  };
}

function summaryFromSquare(square: SnapshotSquare): StationSummary {
  return {
    id: square.id,
    name: square.name,
    coordinate: square.coordinate,
    kind: 'archive-1970',
    year: 1970,
    approximate: true,
    source: 'observatoire',
    frameCount: square.photoCount,
    bounds: square.bounds,
  };
}

function detailFromStation(station: SnapshotStation): StationDetail {
  const referenceImage = imageSource(station.referenceImage);
  const recaptureImage = imageSource(station.recaptureImage);
  const images = [referenceImage, recaptureImage].filter(
    (image): image is ImageSource => image !== undefined,
  );

  return {
    ...summaryFromStation(station),
    description: station.description,
    address: station.address,
    author: station.author,
    currentAuthor: station.recaptureAuthor,
    dateLabel: station.dateLabel,
    referenceImage,
    recaptureImage,
    images,
    archiveLinks: [],
    officialUrl: station.officialUrl,
    hasRecapture: station.hasRecapture,
    sourceLabel:
      station.kind === 'station-2022' ? 'Observatoire · Point de vue 2022' : 'Observatoire · Fonds 1970',
  };
}

function detailFromSquare(square: SnapshotSquare): StationDetail {
  return {
    ...summaryFromSquare(square),
    // Le fonds de 1970 n'est pas rediffusé : on renvoie vers les permaliens du portail des
    // bibliothèques spécialisées, seuls habilités à montrer ces images.
    images: [],
    archiveLinks: archiveLinksOf(square),
    officialUrl: square.officialUrl,
    hasRecapture: square.recaptureCount > 0,
    sourceLabel: 'BHVP · Fonds C’était Paris en 1970',
  };
}

const stations: StationSummary[] = [
  ...SNAPSHOT_STATIONS.map(summaryFromStation),
  ...SNAPSHOT_SQUARES.map(summaryFromSquare),
];

/** Tous les repères de l'Observatoire : reprises publiées, stations 2022 et carrés de 1970. */
export function loadStations(): StationSummary[] {
  return stations;
}

export function loadStationDetail(id: string): StationDetail | undefined {
  const station = findSnapshotStation(id);
  if (station) return detailFromStation(station);

  const square = findSnapshotSquare(id);
  return square ? detailFromSquare(square) : undefined;
}

/**
 * Points de vue de 2022 encore ouverts à la reconduction. Ce sont les meilleures missions à
 * mettre en avant : leur photo de référence est diffusée par l'Observatoire lui-même, et le
 * règlement prévoit sa réutilisation non commerciale par le CAUE et ses partenaires. Le fonds
 * de 1970, lui, reste sous le droit d'auteur des photographes : on n'y renvoie que par lien.
 */
const openMissions: StationDetail[] = SNAPSHOT_STATIONS.filter(
  (station) => station.kind === 'station-2022' && Boolean(station.referenceImage),
).map(detailFromStation);

export function loadOpenMissions(): StationDetail[] {
  return openMissions;
}

/** Mission mise en avant : la plus proche du point donné, à défaut la première. */
export function loadFeaturedMission(near?: { latitude: number; longitude: number }) {
  if (!near) return openMissions[0];

  let closest = openMissions[0];
  let smallest = Infinity;

  for (const mission of openMissions) {
    const dy = mission.coordinate.latitude - near.latitude;
    const dx = mission.coordinate.longitude - near.longitude;
    const distance = dy * dy + dx * dx;
    if (distance < smallest) {
      smallest = distance;
      closest = mission;
    }
  }

  return closest;
}

/**
 * Reprises publiées à mettre en avant dans le fil, celles qui ont bien les deux vues.
 * Un simple filtre, là où il fallait auparavant sonder l'API station par station.
 */
export function loadPublishedSubmissions(limit = 3): StationDetail[] {
  const published: StationDetail[] = [];

  for (const station of SNAPSHOT_STATIONS) {
    if (published.length >= limit) break;
    if (!station.hasRecapture || !station.referenceImage || !station.recaptureImage) continue;
    published.push(detailFromStation(station));
  }

  return published;
}
