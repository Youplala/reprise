import assert from 'node:assert/strict';
import test from 'node:test';
import * as community from '../src/utils/community-stats.ts';

test('retrouve un prénom au-delà du top dix sans perdre la clé du profil', () => {
  assert.equal(typeof community.searchContributors, 'function');
  const contributors = Array.from({ length: 12 }, (_, index) => ({ name: `Paul NOM${index}`, count: 20 - index }));
  contributors.push({ name: 'DUPONT, Élodie', count: 1 });
  assert.deepEqual(community.searchContributors(contributors, '  ELODIE  '), [
    { name: 'DUPONT, Élodie', count: 1 },
  ]);
});

test('recherche dans les noms affichés, conserve les homonymes et accepte une requête vide', () => {
  assert.equal(typeof community.searchContributors, 'function');
  const contributors = [
    { name: 'Zoe DUMAS', count: 4 },
    { name: 'Élodie DURAND', count: 2 },
    { name: 'Élodie DUPONT', count: 1 },
  ];
  assert.equal(community.searchContributors(contributors, '').length, 3);
  assert.equal(community.searchContributors(contributors, 'elodie d').length, 2);
  assert.deepEqual(community.searchContributors(contributors, 'introuvable'), []);
  assert.deepEqual(community.searchContributors([], 'élodie'), []);
  assert.equal(contributors[0].name, 'Zoe DUMAS');
});
