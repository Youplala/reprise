import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { BUNDLED_SNAPSHOT, type Snapshot } from '@/data/snapshot';
import { loadStoredSnapshot, refreshSnapshot } from '@/data/snapshot-store';
import {
  buildOpenMissions,
  buildContributorSubmissions,
  buildPublishedSubmissions,
  buildStationDetail,
  buildStations,
} from '@/services/observatoire-api';
import type { ObservatoireConnection, StationDetail, StationSummary } from '@/types/station';
import { buildCommunityStats, type CommunityStats } from '@/utils/community-stats';
import {
  buildCoverage,
  buildCoverageGrid,
  type CoverageCell,
  type MappingCoverage,
} from '@/utils/mapping-coverage';

type StationsContextValue = {
  stations: StationSummary[];
  grid: CoverageCell[];
  coverage: MappingCoverage;
  stats: CommunityStats;
  openMissions: StationDetail[];
  publishedSubmissions: StationDetail[];
  connection: ObservatoireConnection;
  /** Date du relevé actif, au format ISO court. */
  snapshotVersion: string;
  totalOnline: number;
  findStation: (id: string) => StationSummary | undefined;
  findDetail: (id: string) => StationDetail | undefined;
  findContributorSubmissions: (name: string) => StationDetail[];
};

const StationsContext = createContext<StationsContextValue | null>(null);

export function StationsProvider({ children }: PropsWithChildren) {
  // Le relevé embarqué sert de point de départ : le premier rendu est immédiat, sans écran
  // d'attente. Une version plus récente vient éventuellement le remplacer ensuite.
  const [snapshot, setSnapshot] = useState<Snapshot>(BUNDLED_SNAPSHOT);

  useEffect(() => {
    let cancelled = false;

    const synchronise = async () => {
      const stored = await loadStoredSnapshot();
      if (cancelled) return;
      if (stored !== BUNDLED_SNAPSHOT) setSnapshot(stored);

      const fresher = await refreshSnapshot(stored);
      if (!cancelled && fresher) setSnapshot(fresher);
    };

    void synchronise();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<StationsContextValue>(() => {
    const stations = buildStations(snapshot);
    const stationsById = new Map(stations.map((station) => [station.id, station]));

    return {
      stations,
      grid: buildCoverageGrid(snapshot, stations),
      coverage: buildCoverage(snapshot),
      stats: buildCommunityStats(snapshot),
      openMissions: buildOpenMissions(snapshot),
      publishedSubmissions: buildPublishedSubmissions(snapshot, 6),
      connection: 'snapshot',
      snapshotVersion: snapshot.version,
      totalOnline: stations.length,
      findStation: (id: string) => stationsById.get(id),
      findDetail: (id: string) => buildStationDetail(snapshot, id),
      findContributorSubmissions: (name: string) =>
        buildContributorSubmissions(snapshot, name),
    };
  }, [snapshot]);

  return <StationsContext.Provider value={value}>{children}</StationsContext.Provider>;
}

export function useStations() {
  const value = useContext(StationsContext);
  if (!value) throw new Error('useStations must be used inside StationsProvider');
  return value;
}

/** Mission mise en avant : la plus proche du point donné parmi les points de vue encore ouverts. */
export function useFeaturedMission(near?: { latitude: number; longitude: number }) {
  const { openMissions } = useStations();

  return useMemo(() => {
    if (!openMissions.length) return undefined;
    if (!near) return openMissions[0];

    let closest = openMissions[0];
    let smallest = Infinity;

    for (const mission of openMissions) {
      const dy = mission.coordinate.latitude - near.latitude;
      const dx = mission.coordinate.longitude - near.longitude;
      const distance = dy * dy + dx * dx;
      if (distance < smallest) {
        smallest = distance;
        closest = mission;
      }
    }

    return closest;
  }, [near, openMissions]);
}

export function useStationDetailFromContext(id?: string) {
  const { findDetail } = useStations();
  return useMemo(() => (id ? findDetail(id) : undefined), [findDetail, id]);
}
