type MapSelectable = {
  id: string;
  approximate: boolean;
};

export function retainExplicitMapSelection<T extends MapSelectable>(
  visible: T[],
  selectedId: string | undefined,
  eligibleStations: T[],
  limit: number,
) {
  const capped = visible.slice(0, limit);
  if (!selectedId) return capped;

  const currentSelected = eligibleStations.find((station) => station.id === selectedId);
  if (!currentSelected || currentSelected.approximate) return capped;

  const selectedIndex = capped.findIndex((station) => station.id === selectedId);
  if (selectedIndex >= 0) {
    return capped.map((station, index) => (index === selectedIndex ? currentSelected : station));
  }
  return [currentSelected, ...capped].slice(0, limit);
}
