import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const officialService = readFileSync(
  new URL('../src/services/official-submission.ts', import.meta.url),
  'utf8',
);
const referenceDownloadService = readFileSync(
  new URL('../src/services/official-reference-download.ts', import.meta.url),
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
const alignmentScreen = readFileSync(
  new URL('../src/screens/alignment/index.tsx', import.meta.url),
  'utf8',
);
const officialScreen = readFileSync(
  new URL('../src/screens/official-submission/index.tsx', import.meta.url),
  'utf8',
);

test('la préparation automatique ne demande aucun accès Photos et reste éphémère', () => {
  assert.doesNotMatch(officialService, /expo-media-library|requestPermissionsAsync|createAssetAsync/);
  assert.doesNotMatch(officialService, /getAlbumAsync|createAlbumAsync|addAssetsToAlbumAsync/);
  assert.match(fieldbookService, /requestPermissionsAsync\(true, \[\]\)/);
  assert.doesNotMatch(fieldbookService, /getAlbumAsync|createAlbumAsync|addAssetsToAlbumAsync/);
  assert.doesNotMatch(fieldbookService, /assertOfficialImageSize/);
});

test('la référence distante est récupérée en mémoire sans copie temporaire disque', () => {
  assert.match(officialService, /fetchOfficialReferenceUpload\(uri, filename\)/);
  assert.doesNotMatch(officialService, /File\.downloadFileAsync/);
  assert.doesNotMatch(officialService, /Paths\.cache/);
});

test('la destination finale après redirection reste sur une source d’archive autorisée', () => {
  assert.match(
    referenceDownloadService,
    /isAllowedOfficialReferenceUri\(response\.url\)/,
  );
});

test('la copie utilisateur dans Photos reste distincte de la pièce jointe automatique', () => {
  assert.doesNotMatch(officialService, /album Reprise|album dédié|Photos \(Récents\)/);
  assert.doesNotMatch(reviewScreen, /album Reprise/);
  assert.match(reviewScreen, /Photos \(Récents\)/);
  assert.match(officialScreen, /Les deux photos sont ajoutées automatiquement/);
  assert.doesNotMatch(officialScreen, /Écriture dans Photos impossible/);
});

test('l’écran ignore les préparations obsolètes et limite le haptique aux nouveaux succès', () => {
  assert.match(officialScreen, /buildObservatoireFileCleanupScript/);
  assert.match(officialScreen, /generation: preparationGeneration\.current/);
  assert.match(officialScreen, /isCurrentOfficialPreparation\(request, latestPreparationRequest\.current\)/);
  assert.match(officialScreen, /didAddReadyImage\(previous\.images, result\.images\)/);
  assert.match(officialScreen, /isCurrentOfficialFileMessage\(/);
  assert.match(officialScreen, /documentGenerationRef\.current/);
  assert.match(officialScreen, /images: emptyPreparedImages\(\)/);
  const invalidation = officialScreen.indexOf('automaticPreparationKey.current = key');
  const incompleteReturn = officialScreen.indexOf(
    'if (isSimulated || !uri || !trustedReferenceUri) return',
  );
  const invalidationBlock = officialScreen.slice(invalidation, incompleteReturn);
  assert.ok(invalidation >= 0 && incompleteReturn > invalidation);
  assert.match(invalidationBlock, /setImageError\(undefined\)/);
});

test('le deep link ne peut pas autoriser lui-même une lecture ou un téléchargement', () => {
  assert.match(officialScreen, /isOfficialCaptureAuthorized\(id, uri\)/);
  assert.match(officialScreen, /currentAuthorized: Boolean\(uri && uri === authorizedCurrentUri\)/);
  assert.match(officialService, /isAllowedOfficialReferenceUri\(uri\)/);
});

test('le formulaire conserve l’URI caméra pour vérifier la taille d’une photo déjà sauvegardée', () => {
  assert.match(reviewScreen, /const captureUri = uri \?\? savedCaptureUri \?\? ''/);
  assert.doesNotMatch(reviewScreen, /authorizeOfficialCapture/);
  assert.match(alignmentScreen, /authorizeOfficialCapture\(id \?\? '', captureUri\)/);
});
