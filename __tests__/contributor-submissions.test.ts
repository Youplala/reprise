import { type Snapshot, type SnapshotStation } from '@/data/snapshot';
import { buildContributorSubmissions } from '@/services/observatoire-api';

it('présente les reprises du contributeur de la plus récente à la plus ancienne, puis sans date', () => {
  const base: SnapshotStation = {
    id: 'old', name: 'Une rue', coordinate: { latitude: 48.85, longitude: 2.35 },
    kind: 'recapture-1970', year: 1970, approximate: false, hasRecapture: true,
    recaptureAuthor: 'Élodie D.', referenceImage: 'https://example.test/before.jpg',
    recaptureImage: 'https://example.test/after.jpg', officialUrl: 'https://example.test/photo',
  };
  const stations = [
    { ...base, recaptureDate: '2026-01-20' },
    { ...base, id: 'undated' },
    { ...base, id: 'recent', recaptureDate: '2026-09-14' },
    { ...base, id: 'other', recaptureAuthor: 'Marc D.', recaptureDate: '2026-09-15' },
  ];
  const snapshot = { stations } as Snapshot;
  expect(buildContributorSubmissions(snapshot, 'elodie d.').map(({ id }) => id))
    .toEqual(['recent', 'old', 'undated']);
  expect(stations.map(({ id }) => id)).toEqual(['old', 'undated', 'recent', 'other']);
});
