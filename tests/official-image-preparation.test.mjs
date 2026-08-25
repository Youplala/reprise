import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertOfficialImageContent,
  assertOfficialImageSize,
  didAddReadyImage,
  emptyPreparedImages,
  imageFilenameForUri,
  OfficialImagePreparationError,
  prepareImagePair,
  tryStartImagePreparation,
} from '../src/services/official-image-preparation.ts';

const uris = {
  currentUri: 'file:///capture.jpg',
  referenceUri: 'https://example.test/archive.jpg',
};

test('réinitialise les deux indicateurs visuels lors d’une transition de source', () => {
  assert.deepEqual(emptyPreparedImages(), {
    current: { ready: false },
    reference: { ready: false },
  });
});

test('prépare les deux images quand chaque écriture réussit', async () => {
  const saved = [];
  const result = await prepareImagePair({
    ...uris,
    requestPermission: async () => true,
    save: async (kind) => saved.push(kind),
  });

  assert.deepEqual(result, {
    current: { ready: true },
    reference: { ready: true },
  });
  assert.deepEqual(saved, ['current', 'reference']);
});

test('préserve la photo actuelle quand le téléchargement de la référence échoue', async () => {
  const result = await prepareImagePair({
    ...uris,
    requestPermission: async () => true,
    save: async (kind) => {
      if (kind === 'reference') throw new OfficialImagePreparationError('download-failed');
    },
  });

  assert.deepEqual(result, {
    current: { ready: true },
    reference: { ready: false, error: 'download-failed' },
  });
});

test('préserve la référence quand l’écriture de la photo actuelle échoue', async () => {
  const result = await prepareImagePair({
    ...uris,
    requestPermission: async () => true,
    save: async (kind) => {
      if (kind === 'current') throw new OfficialImagePreparationError('save-failed');
    },
  });

  assert.deepEqual(result, {
    current: { ready: false, error: 'save-failed' },
    reference: { ready: true },
  });
});

test('retourne un état explicite par fichier quand Photos est refusé', async () => {
  const result = await prepareImagePair({
    ...uris,
    requestPermission: async () => false,
    save: async () => assert.fail('aucune écriture ne doit être tentée'),
  });

  assert.deepEqual(result, {
    current: { ready: false, error: 'permission-denied' },
    reference: { ready: false, error: 'permission-denied' },
  });
});

test('un retry ne réécrit pas une image déjà prête', async () => {
  const saved = [];
  const first = await prepareImagePair({
    ...uris,
    requestPermission: async () => true,
    save: async (kind) => {
      if (kind === 'reference') throw new OfficialImagePreparationError('download-failed');
      saved.push(kind);
    },
  });
  const retry = await prepareImagePair({
    ...uris,
    previous: first,
    requestPermission: async () => true,
    save: async (kind) => saved.push(kind),
  });

  assert.deepEqual(retry, {
    current: { ready: true },
    reference: { ready: true },
  });
  assert.deepEqual(saved, ['current', 'reference']);
});

test('une URI absente est signalée sans bloquer l’autre fichier', async () => {
  const result = await prepareImagePair({
    currentUri: uris.currentUri,
    requestPermission: async () => true,
    save: async () => undefined,
  });

  assert.deepEqual(result, {
    current: { ready: true },
    reference: { ready: false, error: 'missing-uri' },
  });
});

test('conserve l’extension PNG ou JPEG de la source distante', () => {
  assert.equal(
    imageFilenameForUri('reprise-42-reference', 'https://example.test/archive.PNG?download=1'),
    'reprise-42-reference.png',
  );
  assert.equal(
    imageFilenameForUri('reprise-42-reference', 'https://example.test/archive.jpeg'),
    'reprise-42-reference.jpeg',
  );
});

test('refuse une source distante sans extension image vérifiable', () => {
  assert.throws(
    () => imageFilenameForUri('reprise-42-reference', 'https://example.test/archive'),
    (error) => error instanceof OfficialImagePreparationError && error.code === 'unsupported-format',
  );
});

test('accepte uniquement JPG/JPEG et PNG, conformément au formulaire live', () => {
  assert.throws(
    () => imageFilenameForUri('reprise-42', 'file:///capture.heic'),
    (error) => error instanceof OfficialImagePreparationError && error.code === 'unsupported-format',
  );
  assert.doesNotThrow(() =>
    assertOfficialImageContent(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'file:///capture.jpg'),
  );
  assert.doesNotThrow(() =>
    assertOfficialImageContent(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'https://example.test/archive.png',
    ),
  );
});

test('refuse une extension trompeuse dont les octets ne sont pas une image valide', () => {
  assert.throws(
    () => assertOfficialImageContent(new TextEncoder().encode('<html>erreur</html>'), 'archive.jpg'),
    (error) =>
      error instanceof OfficialImagePreparationError && error.code === 'invalid-image-content',
  );
  assert.throws(
    () =>
      assertOfficialImageContent(
        Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
        'archive.png',
      ),
    (error) =>
      error instanceof OfficialImagePreparationError && error.code === 'invalid-image-content',
  );
});

test('refuse explicitement un fichier qui dépasse la limite officielle de 8 Mo', () => {
  assert.doesNotThrow(() => assertOfficialImageSize(8 * 1024 * 1024));
  assert.throws(
    () => assertOfficialImageSize(8 * 1024 * 1024 + 1),
    (error) => error instanceof OfficialImagePreparationError && error.code === 'file-too-large',
  );
});

test('refuse explicitement un fichier dont la taille ne peut pas être vérifiée', () => {
  assert.throws(
    () => assertOfficialImageSize(null),
    (error) => error instanceof OfficialImagePreparationError && error.code === 'size-check-failed',
  );
});

test('le verrou synchrone refuse un second démarrage concurrent', () => {
  const inFlight = { current: false };

  assert.equal(tryStartImagePreparation(inFlight), true);
  assert.equal(tryStartImagePreparation(inFlight), false);
});

test('le succès ne correspond qu’à une image devenue prête pendant la tentative', () => {
  const previous = {
    current: { ready: true },
    reference: { ready: false, error: 'download-failed' },
  };

  assert.equal(didAddReadyImage(previous, previous), false);
  assert.equal(
    didAddReadyImage(previous, {
      current: { ready: true },
      reference: { ready: false, error: 'download-failed' },
    }),
    false,
  );
  assert.equal(
    didAddReadyImage(previous, {
      current: { ready: true },
      reference: { ready: true },
    }),
    true,
  );
});
