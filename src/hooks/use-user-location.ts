import * as Location from 'expo-location';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { PARIS_CENTER } from '@/data/archive';
import { shouldAutoLocate } from '@/services/location-preference';
import {
  createUserLocationState,
  reduceUserLocationState,
} from '@/services/user-location-state';

type UseUserLocationOptions = {
  autoLocate?: boolean;
};

export function useUserLocation({ autoLocate = false }: UseUserLocationOptions = {}) {
  const requestVersion = useRef(0);
  const inFlight = useRef(false);
  const [{ coordinate, isPrecise, loading, error }, dispatch] = useReducer(
    reduceUserLocationState,
    createUserLocationState(PARIS_CENTER, autoLocate),
  );

  const locate = useCallback(async () => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    const version = ++requestVersion.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    dispatch({ type: 'start' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (version !== requestVersion.current) return undefined;
      if (!permission.granted) {
        dispatch({ type: 'failure', error: 'Position non autorisée' });
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
      dispatch({ type: 'success', coordinate: nextCoordinate });
      return nextCoordinate;
    } catch {
      if (version === requestVersion.current) dispatch({ type: 'failure', error: 'Position indisponible' });
      return undefined;
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion.current) {
        inFlight.current = false;
        dispatch({ type: 'stop' });
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
        dispatch({ type: 'stop' });
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
