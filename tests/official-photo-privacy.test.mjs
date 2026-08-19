import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const officialService = readFileSync(
  new URL('../src/services/official-submission.ts', import.meta.url),
  'utf8',
);
const fieldbookService = readFileSync(
  new URL('../src/services/fieldbook.ts', import.meta.url),
  'utf8',
);
const reviewScreen = readFileSync(
  new URL('../src/screens/review/index.tsx', import.meta.url),
  'utf8',
);
const officialScreen = readFileSync(
  new URL('../src/screens/official-submission/index.tsx', import.meta.url),
  'utf8',
);

test('les écritures add-only ne tentent aucune lecture ni organisation en album', () => {
  for (const source of [officialService, fieldbookService]) {
    assert.doesNotMatch(source, /getAlbumAsync|createAlbumAsync|addAssetsToAlbumAsync/);
    assert.match(source, /requestPermissionsAsync\(true, \[\]\)/);
  }
  assert.doesNotMatch(fieldbookService, /assertOfficialImageSize/);
  assert.match(
    officialService,
    /assertOfficialImageSize\(new File\(input\.currentUri\)\.size\)/,
  );
});

test('la copie utilisateur promet seulement Photos et Récents', () => {
  assert.doesNotMatch(officialService, /album Reprise|album dédié/);
  assert.doesNotMatch(reviewScreen, /album Reprise/);
  assert.match(officialService, /Photos \(Récents\)/);
  assert.match(reviewScreen, /Photos \(Récents\)/);
});

test('l’écran applique le verrou synchrone et limite le haptique aux nouveaux succès', () => {
  assert.match(officialScreen, /tryStartImagePreparation\(imagePreparationInFlight\)/);
  assert.match(officialScreen, /didAddReadyImage\(previous, result\)/);
});

test('le formulaire conserve l’URI caméra pour vérifier la taille d’une photo déjà sauvegardée', () => {
  assert.match(reviewScreen, /uri: uri \?\? savedCaptureUri \?\? ''/);
});
