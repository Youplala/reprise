import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { trySetLocationPreference } from '../src/services/location-preference.ts';
import {
  HISTORIC_GRID_COUNT,
  LOCATION_PRIVACY_COPY,
} from '../src/services/onboarding.ts';

test('présente le nombre historique officiel de carrés du concours', () => {
  assert.equal(HISTORIC_GRID_COUNT, 1755);
});

test('ne présente plus l’ancien sous-ensemble importé comme la grille historique complète', () => {
  for (const relativePath of [
    '../README.md',
    '../docs/PUBLICATION.md',
    '../src/screens/coverage/index.tsx',
  ]) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /1[ . ]171/);
  }
});

test('décrit honnêtement le traitement local et volontaire des coordonnées', () => {
  assert.match(LOCATION_PRIVACY_COPY, /enregistrées dans votre carnet/);
  assert.match(LOCATION_PRIVACY_COPY, /formulaire officiel/);
  assert.match(LOCATION_PRIVACY_COPY, /jamais envoyées sans votre validation/);
  assert.doesNotMatch(LOCATION_PRIVACY_COPY, /ni enregistrée, ni publiée/);
});

test('une panne du stockage de préférence ne bloque pas la sortie de l’onboarding', async () => {
  const saved = await trySetLocationPreference('manual', async () => {
    throw new Error('storage unavailable');
  });

  assert.equal(saved, false);
});

test('confirme une préférence écrite normalement', async () => {
  let received;
  const saved = await trySetLocationPreference('nearby', async (preference) => {
    received = preference;
  });

  assert.equal(saved, true);
  assert.equal(received, 'nearby');
});