import assert from 'node:assert/strict';
import test from 'node:test';

import { trySetLocationPreference } from '../src/services/location-preference.ts';
import {
  HISTORIC_GRID_COUNT,
  LOCATION_PRIVACY_COPY,
} from '../src/services/onboarding.ts';

test('présente le nombre historique officiel de carrés du concours', () => {
  assert.equal(HISTORIC_GRID_COUNT, 1755);
});

test('décrit honnêtement le traitement local et volontaire des coordonnées', () => {
  assert.match(LOCATION_PRIVACY_COPY, /conservées dans votre carnet/);
  assert.match(LOCATION_PRIVACY_COPY, /formulaire officiel/);
  assert.match(LOCATION_PRIVACY_COPY, /Rien n’est envoyé sans votre validation/);
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