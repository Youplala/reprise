import { buildArchiveRecaptureIndex, archivePhotoKey } from '@/utils/archive-recaptures';
import { BUNDLED_SNAPSHOT, type SnapshotStation } from '@/data/snapshot';
import { buildStationDetail, buildStations } from '@/services/observatoire-api';

const base: SnapshotStation = {
  id: 'old', name: 'Une rue', kind: 'recapture-1970', year: 1970, approximate: false,
  coordinate: { latitude: 48.85, longitude: 2.35 }, hasRecapture: true,
  referenceImage: 'https://example.test/1970-ark-73873-frcgmnov-751045102-laf-b1869106-v0015.jpg',
  recaptureImage: 'https://example.test/after.jpg', officialUrl: 'https://example.test/fiche',
};

it('relie la vue complète ARK à son fichier de reprise, sans confondre deux vues ou deux fonds', () => {
  expect(archivePhotoKey('https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAF/B1869106/v0015'))
    .toBe('frcgmnov-751045102-laf/b1869106/v0015');
  expect(archivePhotoKey(base.referenceImage)).toBe('frcgmnov-751045102-laf/b1869106/v0015');
  expect(archivePhotoKey('https://example.test/b1869106v0015.jpg')).toBeUndefined();
  expect(archivePhotoKey('%broken')).toBeUndefined();
});

it('compte les vues identifiées, pas les dépôts voisins, et expose toutes les reprises dans le carré', () => {
  const snapshot = {
    ...BUNDLED_SNAPSHOT,
    archive: { ...BUNDLED_SNAPSHOT.archive, fonds: ['FRCGMNOV-751045102-LAF'] },
    squares: [{ ...BUNDLED_SNAPSHOT.squares[0], id: 'square', photoCount: 2, recaptureCount: 99,
      refs: [[0, 'B1869106', [15, 16]]] as [number, string, number[]][] }],
    stations: [base, { ...base, id: 'second', recaptureDate: '2026-09-14' },
      { ...base, id: 'near-but-unknown', referenceImage: 'https://example.test/unknown.jpg' }],
  };
  expect(buildStations(snapshot).find(s => s.id === 'square')).toMatchObject({ remainingCount: 1, publishedCount: 1 });
  const detail = buildStationDetail(snapshot, 'square');
  const link = 'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAF/B1869106/v0015';
  expect(detail?.archiveRecaptures?.[link]?.map(s => s.id)).toEqual(['second', 'old']);
});

it('conserve plusieurs reprises de la même vue, dédupliquées par fiche et classées par date', () => {
  const recent = { ...base, id: 'recent', recaptureDate: '2026-09-14' };
  const index = buildArchiveRecaptureIndex([
    { ...base, recaptureDate: '2026-01-20' }, recent, recent,
    { ...base, id: 'other-view', referenceImage: base.referenceImage!.replace('v0015', 'v0016') },
    { ...base, id: 'other-fonds', referenceImage: base.referenceImage!.replace('-laf-', '-lae-') },
    { ...base, id: 'incomplete', recaptureImage: undefined },
    { ...base, id: '2022', kind: 'station-2022', year: 2022 },
  ]);
  expect(index.get('frcgmnov-751045102-laf/b1869106/v0015')?.map(item => item.id)).toEqual(['recent', 'old']);
  expect(index.get('frcgmnov-751045102-laf/b1869106/v0016')?.map(item => item.id)).toEqual(['other-view']);
  expect(index.get('frcgmnov-751045102-laf/b1869106/v0099')).toBeUndefined();
});
