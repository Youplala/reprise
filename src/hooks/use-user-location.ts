import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { PARIS_CENTER } from '@/data/archive';
import type { Coordinate } from '@/types/station';

export function useUserLocation() {
  const [coordinate, setCoordinate] = useState<Coordinate>(PARIS_CENTER);
  const [isPrecise, setIsPrecise] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const locate = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Position non autorisée');
        return;
      }

      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextCoordinate = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      setCoordinate(nextCoordinate);
      setIsPrecise(true);
      return nextCoordinate;
    } catch {
      setError('Position indisponible');
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  return { coordinate, isPrecise, loading, error, locate };
}
