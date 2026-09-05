import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  historicalReferenceForFrame,
  referenceUriOf,
  validatedHistoricalReferenceUri,
} from '../src/services/camera-reference.ts';

const historical1970A = { uri: 'https://example.test/archive-a.jpg' };
const historical1970B = { uri: 'https://example.test/archive-b.jpg' };
const recapture2026 = { uri: 'https://example.test/recapture.jpg' };

test('une sélection 2026 se résout vers la photographie historique', () => {
  assert.deepEqual(
    historicalReferenceForFrame({
      images: [historical1970A, recapture2026],
      recaptureImage: recapture2026,
      referenceImage: historical1970A,
      requestedFrame: 1,
    }),
    { frameIndex: 0, image: historical1970A },
  );
});

test('une sélection parmi plusieurs archives conserve son index historique', () => {
  assert.deepEqual(
    historicalReferenceForFrame({
      images: [historical1970A, historical1970B],
      requestedFrame: 1,
    }),
    { frameIndex: 1, image: historical1970B },
  );
});

test('une reprise seule ne peut jamais devenir la référence historique', () => {
  assert.deepEqual(
    historicalReferenceForFrame({
      images: [recapture2026],
      recaptureImage: recapture2026,
      requestedFrame: 0,
    }),
    { frameIndex: 0, image: undefined },
  );
});

test('l’index demandé est conservé pendant le chargement des archives', () => {
  assert.deepEqual(
    historicalReferenceForFrame({ images: [], requestedFrame: 3 }),
    { frameIndex: 3, image: undefined },
  );
});

test('extrait uniquement les URI transportables des références', () => {
  assert.equal(referenceUriOf(historical1970B), historical1970B.uri);
  assert.equal(referenceUriOf(42), undefined);
  assert.equal(referenceUriOf(undefined), undefined);
});

test('conserve la référence transportée si elle appartient toujours aux archives historiques', () => {
  assert.equal(
    validatedHistoricalReferenceUri({
      candidateUri: historical1970B.uri,
      images: [historical1970B, historical1970A, recapture2026],
      recaptureImage: recapture2026,
      referenceImage: historical1970A,
    }),
    historical1970B.uri,
  );
  assert.equal(
    validatedHistoricalReferenceUri({
      candidateUri: recapture2026.uri,
      images: [historical1970A, recapture2026],
      recaptureImage: recapture2026,
      referenceImage: historical1970A,
    }),
    undefined,
  );
});

test('le viseur physique sans permission ne réutilise aucune photo comme faux fond', () => {
  const source = fs.readFileSync(
    new URL('../src/screens/alignment/index.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /detail\?\.recaptureImage\s*\?\?/);
  assert.match(source, /liveCamera\s*\?\s*\(\s*<CameraView/);
  assert.match(source, /Device\.isDevice && !permission\?\.granted/);
  assert.match(source, /Device\.isDevice && !liveCamera/);
  assert.match(source, /permission\?\.canAskAgain/);
  assert.match(source, /\[permission, requestPermission, refreshPermission\] = useCameraPermissions/);
  assert.match(source, /useCameraPermissions\(\{ get: false \}\)/);
  assert.match(source, /permissionRefreshInFlight\.current/);
  assert.match(source, /AppState\.addEventListener\(['"]change['"]/);
  assert.match(source, /nextState === ['"]active['"] && isFocused/);
  assert.match(source, /void refreshPermission\(\)/);
  assert.match(source, /if \(mounted\)/);
  assert.match(source, /return \(\) => \{/);
  assert.match(source, /subscription\.remove\(\)/);
  assert.match(source, /Linking\.openSettings/);
  assert.match(source, /accessibilityState=\{\{ disabled:/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
  assert.match(source, /Autoriser la caméra/);
  assert.match(source, /Ouvrir les Réglages/);
});

test('la review et le dépôt officiel propagent la référence résolue par le viseur', () => {
  const alignment = fs.readFileSync(
    new URL('../src/screens/alignment/index.tsx', import.meta.url),
    'utf8',
  );
  const review = fs.readFileSync(
    new URL('../src/screens/review/index.tsx', import.meta.url),
    'utf8',
  );
  const official = fs.readFileSync(
    new URL('../src/screens/official-submission/index.tsx', import.meta.url),
    'utf8',
  );

  assert.match(alignment, /referenceUri:/);
  assert.match(review, /referenceUri/);
  assert.match(official, /referenceUri/);
});
