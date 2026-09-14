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
  const autoLocateStarted = useRef(false);
  const [{ coordinate, isPrecise, loading, error }, dispatch] = useReducer(
    reduceUserLocationState,
    createUserLocationState(PARIS_CENTER, autoLocate),
  );

  const locate = useCallback(async () => {
    dispatch({ type: 'start' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        dispatch({ type: 'failure', error: 'Position non autorisée' });
        return;
      }

      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextCoordinate = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      dispatch({ type: 'success', coordinate: nextCoordinate });
      return nextCoordinate;
    } catch {
      dispatch({ type: 'failure', error: 'Position indisponible' });
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!autoLocate || autoLocateStarted.current) return;
    autoLocateStarted.current = true;
    void shouldAutoLocate()
      .then((enabled) => {
        if (enabled) return locate();
        dispatch({ type: 'stop' });
        return undefined;
      })
      .catch(() => void locate());
  }, [autoLocate, locate]);

  return { coordinate, isPrecise, loading, error, locate };
}
