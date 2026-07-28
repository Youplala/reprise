import { createContext, PropsWithChildren, useCallback, useContext, useMemo } from 'react';

import { SNAPSHOT_VERSION } from '@/data/snapshot';
import { loadStations } from '@/services/observatoire-api';
import type { ObservatoireConnection, StationSummary } from '@/types/station';
import { MAPPING_COVERAGE, type MappingCoverage } from '@/utils/mapping-coverage';

type StationsContextValue = {
  stations: StationSummary[];
  connection: ObservatoireConnection;
  /** Date du relevé embarqué, au format ISO court. */
  snapshotVersion: string;
  totalOnline: number;
  coverage: MappingCoverage;
  findStation: (id: string) => StationSummary | undefined;
};

const StationsContext = createContext<StationsContextValue | null>(null);

// L'instantané étant en mémoire, la liste ne change jamais en cours de session : elle se
// construit une seule fois, hors du rendu.
const stations: StationSummary[] = loadStations();

const stationsById = new Map(stations.map((station) => [station.id, station]));

export function StationsProvider({ children }: PropsWithChildren) {
  const findStation = useCallback((id: string) => stationsById.get(id), []);

  const value = useMemo(
    () => ({
      stations,
      connection: 'snapshot' as const,
      snapshotVersion: SNAPSHOT_VERSION,
      totalOnline: stations.length,
      coverage: MAPPING_COVERAGE,
      findStation,
    }),
    [findStation],
  );

  return <StationsContext.Provider value={value}>{children}</StationsContext.Provider>;
}

export function useStations() {
  const value = useContext(StationsContext);
  if (!value) throw new Error('useStations must be used inside StationsProvider');
  return value;
}
