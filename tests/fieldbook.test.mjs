import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFieldbookStore,
  FIELD_BOOK_KEY,
} from '../src/services/fieldbook-store.ts';
import { getFieldbookViewState } from '../src/services/fieldbook-view-state.ts';

function setup(initial = null) {
  let value = initial;
  const existing = new Set(['file:///cache/legacy.jpg']);
  const removed = [];
  const copied = [];
  const storage = {
    async getItem(key) {
      assert.equal(key, FIELD_BOOK_KEY);
      return value;
    },
    async setItem(key, next) {
      assert.equal(key, FIELD_BOOK_KEY);
      value = next;
    },
  };
  const files = {
    async copyToDocuments(source, id) {
      copied.push(source);
      const uri = `file:///documents/reprise-captures/${id}.jpg`;
      existing.add(uri);
      return uri;
    },
    async exists(uri) {
      return existing.has(uri);
    },
    isManaged(uri) {
      return uri.startsWith('file:///documents/reprise-captures/');
    },
    async remove(uri) {
      removed.push(uri);
      existing.delete(uri);
    },
  };
  const store = createFieldbookStore({
    storage,
    files,
    now: () => new Date('2026-08-11T17:00:00.000Z'),
  });
  return { copied, files, getValue: () => value, removed, store };
}

test('copie la capture dans Documents avant de créer le brouillon', async () => {
  const { copied, getValue, store } = setup();
  const capture = await store.save({
    stationId: 'station-1',
    stationName: 'Rue de Rivoli',
    frameIndex: 2,
    imageUri: 'file:///cache/capture.jpg',
    simulated: false,
  });

  assert.deepEqual(copied, ['file:///cache/capture.jpg']);
  assert.match(capture.imageUri, /^file:\/\/\/documents\/reprise-captures\//);
  assert.equal(JSON.parse(getValue())[0].schemaVersion, 2);
});

test('migre sans crash une entrée v1 encore disponible dans le cache', async () => {
  const legacy = JSON.stringify([
    {
      id: 'station-1-1',
      stationId: 'station-1',
      frame: 3,
      imageUri: 'file:///cache/legacy.jpg',
      simulated: false,
      createdAt: '2026-08-10T12:00:00.000Z',
    },
  ]);
  const { copied, getValue, store } = setup(legacy);

  const [capture] = await store.list();
  assert.equal(capture.schemaVersion, 2);
  assert.equal(capture.frameIndex, 3);
  assert.deepEqual(copied, ['file:///cache/legacy.jpg']);
  assert.match(capture.imageUri, /^file:\/\/\/documents\/reprise-captures\//);
  assert.equal(JSON.parse(getValue())[0].schemaVersion, 2);
});

test('nettoie une référence cassée sans faire tomber le carnet', async () => {
  const broken = JSON.stringify([
    {
      schemaVersion: 2,
      id: 'station-1-1',
      stationId: 'station-1',
      frameIndex: 0,
      imageUri: 'file:///cache/missing.jpg',
      simulated: false,
      preparation: { current: false, reference: false },
      createdAt: '2026-08-10T12:00:00.000Z',
    },
  ]);
  const { getValue, store } = setup(broken);

  assert.deepEqual(await store.list(), []);
  assert.deepEqual(JSON.parse(getValue()), []);
});

test('supprime ensemble le fichier privé et ses métadonnées sans toucher Photos', async () => {
  const { getValue, removed, store } = setup();
  const capture = await store.save({
    stationId: 'station-1',
    frameIndex: 0,
    imageUri: 'file:///cache/capture.jpg',
    simulated: false,
  });
  await store.update(capture.id, { assetId: 'photos-asset-1' });

  assert.equal(await store.remove(capture.id), true);
  assert.deepEqual(removed, [capture.imageUri]);
  assert.deepEqual(JSON.parse(getValue()), []);
});

test('restaure les métadonnées si le fichier privé ne peut pas être supprimé', async () => {
  const { files, getValue, store } = setup();
  const capture = await store.save({
    stationId: 'station-1',
    frameIndex: 0,
    imageUri: 'file:///cache/capture.jpg',
    simulated: false,
  });
  files.remove = async () => {
    throw new Error('disk-error');
  };

  await assert.rejects(store.remove(capture.id), /disk-error/);
  assert.equal(JSON.parse(getValue()).length, 1);
});

test('conserve les états structurés de préparation et la précision de position', async () => {
  const { getValue, store } = setup();
  const capture = await store.save({
    stationId: 'station-1',
    frameIndex: 0,
    imageUri: 'file:///cache/capture.jpg',
    simulated: false,
    coordinate: { latitude: 48.8566, longitude: 2.3522 },
    locationPrecision: 'approximate',
  });

  const updated = await store.update(capture.id, {
    preparation: {
      current: { ready: true },
      reference: { ready: false, error: 'download-failed' },
    },
  });

  assert.equal(updated.locationPrecision, 'approximate');
  assert.deepEqual(updated.preparation, {
    current: { ready: true },
    reference: { ready: false, error: 'download-failed' },
  });
  assert.deepEqual(JSON.parse(getValue())[0].preparation, updated.preparation);
});

test('expose des états de rendu explicites pour un carnet vide ou rempli', async () => {
  const empty = getFieldbookViewState([]);
  assert.equal(empty.kind, 'empty');
  assert.equal(empty.title, 'Aucun brouillon');

  const { store } = setup();
  const capture = await store.save({
    stationId: 'station-1',
    frameIndex: 0,
    imageUri: 'file:///cache/capture.jpg',
    simulated: false,
  });
  const filled = getFieldbookViewState([capture]);
  assert.equal(filled.kind, 'filled');
  assert.equal(filled.count, 1);
});
