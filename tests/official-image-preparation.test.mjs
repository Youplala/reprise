import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OfficialImagePreparationError,
  prepareImagePair,
} from '../src/services/official-image-preparation.ts';

const uris = {
  currentUri: 'file:///capture.jpg',
  referenceUri: 'https://example.test/archive.jpg',
};

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
