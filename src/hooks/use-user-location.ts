import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PARIS_CENTER } from '@/data/archive';
import { shouldAutoLocate } from '@/services/location-preference';
import type { Coordinate } from '@/types/station';

type UseUserLocationOptions = {
  autoLocate?: boolean;
};

export function useUserLocation({ autoLocate = false }: UseUserLocationOptions = {}) {
  const autoLocateStarted = useRef(false);
  const [coordinate, setCoordinate] = useState<Coordinate>(PARIS_CENTER);
  const [isPrecise, setIsPrecise] = useState(false);
  const [loading, setLoading] = useState(autoLocate);
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

  useEffect(() => {
    if (!autoLocate || autoLocateStarted.current) return;
    autoLocateStarted.current = true;
    void shouldAutoLocate()
      .then((enabled) => {
        if (enabled) return locate();
        setLoading(false);
        return undefined;
      })
      .catch(() => void locate());
  }, [autoLocate, locate]);

  return { coordinate, isPrecise, loading, error, locate };
}
