import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildLocalSuggestion,
  formatSnapshotDate,
} from '../src/services/collective-content.ts';

test('choisit déterministement le secteur avec le plus de missions ouvertes', () => {
  const missions = [
    { id: 'station-z', arrondissement: '12e' },
    { id: 'station-c', arrondissement: '11e' },
    { id: 'station-a', arrondissement: '11e' },
    { id: 'station-b', arrondissement: '12e' },
    { id: 'station-d', arrondissement: '12e' },
    { id: 'sans-secteur' },
  ];

  assert.deepEqual(buildLocalSuggestion(missions), {
    stationId: 'station-b',
    sector: '12e',
    missionCount: 3,
  });
});

test('départage les secteurs et les points de départ sans dépendre de l’ordre du relevé', () => {
  const first = buildLocalSuggestion([
    { id: 'z', arrondissement: '20e' },
    { id: 'b', arrondissement: '10e' },
    { id: 'a', arrondissement: '10e' },
    { id: 'y', arrondissement: '20e' },
  ]);
  const reversed = buildLocalSuggestion([
    { id: 'y', arrondissement: '20e' },
    { id: 'a', arrondissement: '10e' },
    { id: 'b', arrondissement: '10e' },
    { id: 'z', arrondissement: '20e' },
  ]);

  assert.deepEqual(first, { stationId: 'a', sector: '10e', missionCount: 2 });
  assert.deepEqual(reversed, first);
  assert.equal(buildLocalSuggestion([{ id: 'x' }]), undefined);
});

test('utilise le secteur et le nombre de vues encore ouvertes des carrés 1970', () => {
  assert.deepEqual(
    buildLocalSuggestion([
      { id: 'square-12', name: '812', remainingCount: 4 },
      { id: 'square-42', name: '842', remainingCount: 13 },
    ]),
    { stationId: 'square-42', sector: 'secteur 842', missionCount: 13 },
  );
});

test('affiche une date de relevé française', () => {
  assert.equal(formatSnapshotDate('2026-08-11'), '11 août 2026');
  assert.equal(formatSnapshotDate('version-inconnue'), 'version-inconnue');
});

test('l’écran ne rend plus d’interaction ou de sortie communautaire factice', async () => {
  const source = await readFile(
    new URL('../src/screens/collective/index.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /Encourager|Encouragé|MARCHE DE LA COMMUNAUTÉ|Rejoindre la mission/);
  assert.match(source, /INSTANTANÉ DE L’OBSERVATOIRE/);
  assert.match(source, /SUGGESTION LOCALE/);
  assert.match(source, /Données Observatoire : relevé public/);
  assert.match(source, /params: \{ id: localSuggestion\.stationId \}/);
});
