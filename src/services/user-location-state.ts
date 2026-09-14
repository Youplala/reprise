import type { Coordinate } from '@/types/station';

export type UserLocationState = {
  coordinate: Coordinate;
  fallbackCoordinate: Coordinate;
  isPrecise: boolean;
  loading: boolean;
  error?: string;
};

type UserLocationEvent =
  | { type: 'start' }
  | { type: 'success'; coordinate: Coordinate }
  | { type: 'failure'; error: string }
  | { type: 'stop' };

export function createUserLocationState(
  fallbackCoordinate: Coordinate,
  loading: boolean,
): UserLocationState {
  return {
    coordinate: fallbackCoordinate,
    fallbackCoordinate,
    isPrecise: false,
    loading,
  };
}

export function reduceUserLocationState(
  state: UserLocationState,
  event: UserLocationEvent,
): UserLocationState {
  switch (event.type) {
    case 'start':
      return { ...state, loading: true, error: undefined };
    case 'success':
      return {
        ...state,
        coordinate: event.coordinate,
        isPrecise: true,
        loading: false,
        error: undefined,
      };
    case 'failure':
      return {
        ...state,
        coordinate: state.fallbackCoordinate,
        isPrecise: false,
        loading: false,
        error: event.error,
      };
    case 'stop':
      return { ...state, loading: false };
  }
}
