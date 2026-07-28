// Références vers l'Observatoire, et repli de position.
//
// Ce module embarquait treize vues du fonds « C'était Paris en 1970 » (14 Mo en 3 700 px) pour
// alimenter l'écran de superposition. Elles en ont été retirées : ces photographies restent
// sous le droit d'auteur de leurs auteurs, et les diffuser dans une application publiée serait
// une rediffusion sans autorisation. L'app renvoie désormais vers les permaliens du portail des
// bibliothèques spécialisées, et ne superpose que des images diffusées par l'Observatoire.

import type { Coordinate } from '@/types/station';

export const OBSERVATOIRE_HOME_URL = 'https://observatoire-photo.paris/';
export const OBSERVATOIRE_MAP_URL = 'https://observatoire-photo.paris/map';
export const OFFICIAL_GRID_URL =
  'https://opppp.cartes.xyz/uploads/opppp/files/260421-export-grille-concours-1970-wsg84.geojson';

/** Position de repli tant que la localisation n'est pas autorisée. */
export const PARIS_CENTER: Coordinate = { latitude: 48.8566, longitude: 2.3522 };
