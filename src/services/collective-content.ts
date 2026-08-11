export type LocalMission = {
  id: string;
  name?: string;
  arrondissement?: string;
  remainingCount?: number;
};

export type LocalSuggestion = {
  stationId: string;
  sector: string;
  missionCount: number;
};

/**
 * Choisit un secteur à explorer à partir des missions ouvertes du relevé actif.
 * Le tri explicite rend la suggestion stable pour un même instantané, sans prétendre
 * qu'une sortie communautaire existe ou qu'un choix est fait côté serveur.
 */
export function buildLocalSuggestion(missions: readonly LocalMission[]): LocalSuggestion | undefined {
  const bySector = new Map<string, { stationIds: string[]; missionCount: number }>();

  for (const mission of missions) {
    const arrondissement = mission.arrondissement?.trim();
    const name = mission.name?.trim();
    const sector = arrondissement || (name ? `secteur ${name}` : undefined);
    if (!sector) continue;
    const group = bySector.get(sector) ?? { stationIds: [], missionCount: 0 };
    group.stationIds.push(mission.id);
    group.missionCount += Math.max(1, mission.remainingCount ?? 1);
    bySector.set(sector, group);
  }

  const selected = [...bySector.entries()]
    .map(([sector, group]) => ({
      sector,
      stationIds: group.stationIds.sort(),
      missionCount: group.missionCount,
    }))
    .sort(
      (left, right) =>
        right.missionCount - left.missionCount ||
        left.sector.localeCompare(right.sector, 'fr') ||
        left.stationIds[0].localeCompare(right.stationIds[0]),
    )[0];

  if (!selected) return undefined;

  return {
    stationId: selected.stationIds[0],
    sector: selected.sector,
    missionCount: selected.missionCount,
  };
}

export function formatSnapshotDate(version: string): string {
  const date = new Date(`${version}T00:00:00`);
  if (Number.isNaN(date.getTime())) return version;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
