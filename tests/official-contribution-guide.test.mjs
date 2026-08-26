import assert from 'node:assert/strict';
import test from 'node:test';

import { OFFICIAL_CONTRIBUTION_GUIDE } from '../src/services/official-contribution-guide.ts';

test('explique le dépôt officiel en trois étapes courtes et honnêtes', () => {
  assert.equal(OFFICIAL_CONTRIBUTION_GUIDE.length, 3);

  const copy = OFFICIAL_CONTRIBUTION_GUIDE
    .flatMap((slide) => [slide.title, slide.body, ...slide.points])
    .join(' ')
    .toLocaleLowerCase('fr');

  for (const expected of [
    'archive',
    'photo actuelle',
    'adresse',
    'commentaire',
    'identité',
    'règlement',
    'envoi',
    'modération',
  ]) {
    assert.match(copy, new RegExp(expected), expected);
  }
});

test('ne promet jamais que Reprise remplit ou envoie les données personnelles', () => {
  const copy = JSON.stringify(OFFICIAL_CONTRIBUTION_GUIDE).toLocaleLowerCase('fr');
  assert.doesNotMatch(copy, /identité (préremplie|automatique)/);
  assert.doesNotMatch(copy, /envoi automatique/);
});