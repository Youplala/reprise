import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  CAMPAIGN_END_LABEL,
  EXHIBITION_LABEL,
  FIRST_LAUNCH_ONBOARDING,
} from '../src/services/first-launch-onboarding.ts';

const homeSource = fs.readFileSync(
  new URL('../src/screens/home/index.tsx', import.meta.url),
  'utf8',
);

test('raconte la mission, le concours, la reprise assistée et les rendez-vous en quatre écrans', () => {
  assert.equal(FIRST_LAUNCH_ONBOARDING.length, 4);
  const copy = JSON.stringify(FIRST_LAUNCH_ONBOARDING).toLocaleLowerCase('fr');

  for (const expected of [
    'transformations',
    'concours',
    'fnac',
    'ville de paris',
    'bibliothèque historique',
    'avant/après',
    'transparence',
    'superposition',
  ]) {
    assert.match(copy, new RegExp(expected), expected);
  }

  assert.equal(CAMPAIGN_END_LABEL, '30 novembre 2026');
  assert.equal(EXHIBITION_LABEL, '9 juillet au 12 septembre 2026');
});

test('l’accueil affiche le guide une première fois et permet de le revoir', () => {
  assert.match(homeSource, /<FirstLaunchOnboarding/);
  assert.match(homeSource, /shouldShowFirstLaunchOnboarding/);
  assert.match(homeSource, /markFirstLaunchOnboardingSeen/);
  assert.match(homeSource, /accessibilityLabel="Découvrir la mission Reprise"/);
  assert.match(homeSource, /publishedSubmissions\.slice\(0, 2\)/);
});
