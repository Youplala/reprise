import { useStations } from '@/providers/stations-provider';
import { useMemo } from 'react';

/**
 * Le détail vient du relevé actif : il est disponible immédiatement, sans requête, sans état de
 * chargement et sans cache à gérer.
 */
export function useStationDetail(id?: string) {
  const { findStation, findDetail } = useStations();

  const summary = id ? findStation(id) : undefined;
  const detail = useMemo(() => (id ? findDetail(id) : undefined), [findDetail, id]);

  return { detail, summary, loading: false, error: null };
}
