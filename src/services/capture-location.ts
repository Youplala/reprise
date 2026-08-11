import * as Location from 'expo-location';

import type { CaptureLocation } from '@/services/review-status';

const APPROXIMATE_ACCURACY_METERS = 100;

/**
 * Relève la position uniquement si l'utilisateur a déjà accordé la permission.
 * La prise de vue ne déclenche donc jamais une demande supplémentaire juste pour afficher un statut.
 */
export async function readGrantedCaptureLocation(): Promise<CaptureLocation | undefined> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return undefined;

    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const iosReducedAccuracy = permission.ios?.accuracy === 'reduced';
    const measuredAccuracy = result.coords.accuracy;
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      precision:
        iosReducedAccuracy ||
        (typeof measuredAccuracy === 'number' && measuredAccuracy >= APPROXIMATE_ACCURACY_METERS)
          ? 'approximate'
          : 'precise',
    };
  } catch {
    return undefined;
  }
}