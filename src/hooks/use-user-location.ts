import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PARIS_CENTER } from '@/data/archive';
import { shouldAutoLocate } from '@/services/location-preference';
import type { Coordinate } from '@/types/station';

type UseUserLocationOptions = {
  autoLocate?: boolean;
};

export function useUserLocation({ autoLocate = false }: UseUserLocationOptions = {}) {
  const requestVersion = useRef(0);
  const inFlight = useRef(false);
  const [coordinate, setCoordinate] = useState<Coordinate>(PARIS_CENTER);
  const [isPrecise, setIsPrecise] = useState(false);
  const [loading, setLoading] = useState(autoLocate);
  const [error, setError] = useState<string>();

  const locate = useCallback(async () => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    const version = ++requestVersion.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setError(undefined);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (version !== requestVersion.current) return undefined;
      if (!permission.granted) {
        setError('Position non autorisée');
        return;
      }

      // CoreLocation peut attendre indéfiniment, notamment sans GPS simulé.
      // Le délai commence après le choix de permission, pas pendant le dialogue iOS.
      const result = await Promise.race([
        (async () => {
          if (!(await Location.hasServicesEnabledAsync())) {
            throw new Error('Location services disabled');
          }
          return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Location timeout')), 12000);
        }),
      ]);
      if (version !== requestVersion.current) return undefined;
      const nextCoordinate = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      setCoordinate(nextCoordinate);
      setIsPrecise(true);
      return nextCoordinate;
    } catch {
      if (version === requestVersion.current) setError('Position indisponible');
      return undefined;
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!autoLocate) return;
    void shouldAutoLocate()
      .then((enabled) => {
        if (cancelled) return;
        if (enabled) return locate();
        setLoading(false);
        return undefined;
      })
      .catch(() => { if (!cancelled) void locate(); });
    return () => { cancelled = true; };
  }, [autoLocate, locate]);

  useEffect(() => () => {
    requestVersion.current += 1;
    inFlight.current = false;
  }, []);

  return { coordinate, isPrecise, loading, error, locate };
}
