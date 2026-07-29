// Transformation du relevé de l'Observatoire en objets d'écran.
//
// Ce module n'appelle plus l'API amont. Elle est servie sans CDN, sans gzip et en
// `cache-control: private` : l'ouverture coûtait 4,5 Mo, puis jusqu'à dix-huit requêtes de
// détail pour trouver trois reprises à afficher dans le fil.
//
// Les fonctions prennent le relevé en paramètre plutôt que de le lire globalement : c'est ce qui
// permet d'adopter une version téléchargée sans redémarrer l'application.

import type { ImageSource } from 'expo-image';

import {
  archiveLinksOf,
  type Snapshot,
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
      station.kind === 'station-2022'
        ? 'Observatoire · Point de vue 2022'
        : 'Observatoire · Fonds 1970',
  };
}

function detailFromSquare(snapshot: Snapshot, square: SnapshotSquare): StationDetail {
  return {
    ...summaryFromSquare(square),
    // Le fonds de 1970 n'est pas rediffusé : on renvoie vers les permaliens du portail des
    // bibliothèques spécialisées, seuls habilités à montrer ces images.
    images: [],
    archiveLinks: archiveLinksOf(snapshot, square),
    officialUrl: square.officialUrl,
    hasRecapture: square.recaptureCount > 0,
    sourceLabel: 'BHVP · Fonds C’était Paris en 1970',
  };
}

/** Tous les repères : reprises publiées, points de vue 2022 et carrés de 1970. */
export function buildStations(snapshot: Snapshot): StationSummary[] {
  return [
    ...snapshot.stations.map(summaryFromStation),
    ...snapshot.squares.map(summaryFromSquare),
  ];
}

export function buildStationDetail(snapshot: Snapshot, id: string): StationDetail | undefined {
  const station = snapshot.stations.find((candidate) => candidate.id === id);
  if (station) return detailFromStation(station);

  const square = snapshot.squares.find((candidate) => candidate.id === id);
  return square ? detailFromSquare(snapshot, square) : undefined;
}

/**
 * Points de vue de 2022 encore ouverts à la reconduction. Ce sont les meilleures missions à
 * mettre en avant : leur photo de référence est diffusée par l'Observatoire lui-même, et le
 * règlement prévoit sa réutilisation non commerciale par le CAUE et ses partenaires. Le fonds
 * de 1970, lui, reste sous le droit d'auteur des photographes : on n'y renvoie que par lien.
 */
export function buildOpenMissions(snapshot: Snapshot): StationDetail[] {
  return snapshot.stations
    .filter((station) => station.kind === 'station-2022' && Boolean(station.referenceImage))
    .map(detailFromStation);
}

/** Reprises publiées à mettre en avant dans le fil, celles qui ont bien les deux vues. */
export function buildPublishedSubmissions(snapshot: Snapshot, limit = 3): StationDetail[] {
  const published: StationDetail[] = [];

  for (const station of snapshot.stations) {
    if (published.length >= limit) break;
    if (!station.hasRecapture || !station.referenceImage || !station.recaptureImage) continue;
    published.push(detailFromStation(station));
  }

  return published;
}

/** Mission la plus proche du point donné, à défaut la première. */
export function nearestMission(
  missions: StationDetail[],
  near?: { latitude: number; longitude: number },
) {
  if (!near) return missions[0];

  let closest = missions[0];
  let smallest = Infinity;

  for (const mission of missions) {
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
