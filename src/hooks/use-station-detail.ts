import { useMemo } from 'react';

import { useStations } from '@/providers/stations-provider';
import { loadStationDetail } from '@/services/observatoire-api';

/**
 * Le détail vient de l'instantané embarqué : il est disponible immédiatement, sans requête,
 * sans état de chargement et sans cache à gérer.
 */
export function useStationDetail(id?: string) {
  const { findStation } = useStations();
  const summary = id ? findStation(id) : undefined;
  const detail = useMemo(() => (id ? loadStationDetail(id) : undefined), [id]);

  return { detail, summary, loading: false, error: null };
}
