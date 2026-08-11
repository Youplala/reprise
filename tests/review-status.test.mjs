import assert from 'node:assert/strict';
import test from 'node:test';

import { getReviewStatusRows } from '../src/services/review-status.ts';

function copies(input) {
  return getReviewStatusRows(input).map((row) => row.copy);
}

test('décrit une capture réelle localisée et copiée dans Photos sans promettre un original', () => {
  const rows = getReviewStatusRows({
    simulated: false,
    location: { latitude: 48.86, longitude: 2.34, precision: 'precise' },
    saved: true,
    savedToLibrary: true,
  });

  assert.deepEqual(rows.map((row) => row.icon), [
    'checkmark.circle.fill',
    'info.circle.fill',
    'checkmark.circle.fill',
  ]);
  assert.match(rows[0].copy, /Position précise enregistrée/);
  assert.match(rows[1].copy, /recadré et réencodé/);
  assert.match(rows[2].copy, /copie ajoutée à Photos/);
  assert.doesNotMatch(rows.map((row) => row.copy).join(' '), /original/i);
});

test('annonce explicitement une position approximative avant enregistrement', () => {
  const result = copies({
    simulated: false,
    location: { latitude: 48.86, longitude: 2.34, precision: 'approximate' },
    saved: false,
    savedToLibrary: false,
  });

  assert.match(result[0], /Position approximative/);
  assert.match(result[2], /pas encore enregistrée/);
});

test('ne transforme pas un carnet sur cache en conservation durable quand Photos est refusé', () => {
  const rows = getReviewStatusRows({
    simulated: false,
    saved: true,
    savedToLibrary: false,
  });

  assert.match(rows[0].copy, /Position non enregistrée/);
  assert.equal(rows[2].icon, 'exclamationmark.circle.fill');
  assert.match(rows[2].copy, /aucune copie durable confirmée/);
});

test('le simulateur ne revendique ni position ni fichier photo', () => {
  const result = copies({
    simulated: true,
    saved: true,
    savedToLibrary: false,
  });

  assert.match(result[0], /Mode démo/);
  assert.match(result[1], /aucune photo créée/);
  assert.match(result[2], /sans fichier photo/);
});