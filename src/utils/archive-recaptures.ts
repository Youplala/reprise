import type { SnapshotStation } from '@/data/snapshot';

/** Identité de la vue, jamais proximité GPS ni seul numéro de dossier. */
export function archivePhotoKey(value?: string): string | undefined {
  if (!value) return undefined;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return undefined; }
  const match = decoded.match(/\b(frcgmnov-751045102-la[a-j])[-/]([ab]\d+)[-/]v(\d+)(?=$|[^a-z0-9])/i);
  if (!match || Number(match[3]) < 1) return undefined;
  return `${match[1]}/${match[2]}/v${String(Number(match[3])).padStart(4, '0')}`.toLowerCase();
}
export function buildArchiveRecaptureIndex(stations: readonly SnapshotStation[]) {
  const index = new Map<string, SnapshotStation[]>();
  for (const station of stations) {
    if (station.kind !== 'recapture-1970' || !station.hasRecapture || !station.recaptureImage) continue;
    const key = archivePhotoKey(station.referenceImage);
    if (!key) continue;
    const entries = index.get(key) ?? [];
    if (!entries.some(entry => entry.id === station.id)) entries.push(station);
    index.set(key, entries);
  }
  for (const entries of index.values()) {
    entries.sort((a, b) => (b.recaptureDate ?? '').localeCompare(a.recaptureDate ?? '') || a.id.localeCompare(b.id));
  }
  return index;
}
