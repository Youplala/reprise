import type { Coordinate } from '@/types/station';
import { distanceInMeters } from '@/utils/distance';

/** Repère porteur d'un arrondissement : une reprise publiée ou une photo de 2022. */
type LocatedPlace = { coordinate: Coordinate; arrondissement?: string };

export function arrondissementLabel(code: string | undefined) {
  if (!code || !/^750\d{2}$/.test(code)) return undefined;
  const number = Number(code.slice(3));
  return number === 1 ? '1er arrondissement' : `${number}e arrondissement`;
}

/**
 * Un carré du concours de 1970 n'a pas d'arrondissement propre dans le relevé : « Secteur 237 »
 * ne veut rien dire pour l'utilisateur. On reprend celui du repère localisé le plus proche —
 * une reprise publiée ou une photo de 2022 — puisque les arrondissements font plusieurs
 * centaines de mètres de large, largement plus qu'un carré de 250 m.
 */
export function nearestArrondissement(coordinate: Coordinate, located: LocatedPlace[]) {
  let nearest: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of located) {
    if (!candidate.arrondissement) continue;
    const distance = distanceInMeters(coordinate, candidate.coordinate);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = candidate.arrondissement;
    }
  }
  return nearest;
}

/** Nom présentable d'un carré : son arrondissement plutôt que son numéro de secteur interne. */
export function cellPlaceName(
  cell: { center: Coordinate; name: string },
  located: LocatedPlace[],
) {
  return arrondissementLabel(nearestArrondissement(cell.center, located)) ?? `Secteur ${cell.name}`;
}
