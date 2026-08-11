import { archiveLinksOf, isUsableSnapshot, type Snapshot } from '@/data/snapshot';

const snapshot = {
  version: '1',
  generatedAt: '2026-08-11T00:00:00Z',
  metrics: { recapturesPublished: 10 },
  stations: [],
  squares: [{}],
  archive: {
    urlTemplate: 'https://example.test/{fonds}/{document}/{view}',
    viewPadding: 3,
    fonds: ['fonds-a'],
  },
} as unknown as Snapshot;

describe('snapshot parsing', () => {
  it('refuse une réponse vide ou tronquée', () => {
    expect(isUsableSnapshot(undefined)).toBe(false);
    expect(isUsableSnapshot({ ...snapshot, squares: [] })).toBe(false);
    expect(isUsableSnapshot({ ...snapshot, metrics: {} })).toBe(false);
  });

  it('accepte un relevé minimal utilisable', () => {
    expect(isUsableSnapshot(snapshot)).toBe(true);
  });

  it('reconstruit les liens d’archive et ignore un fonds inconnu', () => {
    expect(
      archiveLinksOf(snapshot, {
        refs: [
          [0, 'document-a', 2],
          [0, 'document-b', [4, 7]],
          [4, 'inconnu', 1],
        ],
      }),
    ).toEqual([
      'https://example.test/fonds-a/document-a/001',
      'https://example.test/fonds-a/document-a/002',
      'https://example.test/fonds-a/document-b/004',
      'https://example.test/fonds-a/document-b/007',
    ]);
  });
});
