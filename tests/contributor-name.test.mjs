import assert from 'node:assert/strict';
import test from 'node:test';

import { formatContributorName } from '../src/utils/community-stats.ts';

test('réduit le nom de famille à son initiale, quel que soit l’ordre de la source', () => {
  // Le relevé mêle « Nom, Prénom » (majoritaire, hérité des notices) et « Prénom Nom ».
  assert.equal(formatContributorName('Ahrweiller, Maurice'), 'Maurice A.');
  assert.equal(formatContributorName('Anabelle Ravier'), 'Anabelle R.');
  assert.equal(formatContributorName('Velin, François'), 'François V.');
});

test('uniformise la casse avant de réduire', () => {
  assert.equal(formatContributorName('Christine PUJOL'), 'Christine P.');
  assert.equal(formatContributorName('jean-yves collet'), 'Jean-Yves C.');
});

test('garde la particule sans jamais en faire l’initiale', () => {
  assert.equal(formatContributorName('Martin de Pressensé'), 'Martin de P.');
  assert.equal(formatContributorName('de Pressensé, Martin'), 'Martin de P.');
});

test('laisse intact un prénom déjà abrégé dans la source', () => {
  assert.equal(formatContributorName('Auffret, J.L.'), 'J.L. A.');
  assert.equal(formatContributorName('Aveline, M.'), 'M. A.');
});

test('ne touche pas à un nom qui ne compte qu’un mot', () => {
  assert.equal(formatContributorName('Madonna'), 'Madonna');
  assert.equal(formatContributorName(''), '');
});

test('conserve les prénoms composés en entier', () => {
  assert.equal(formatContributorName('Arroyo, Jean José'), 'Jean José A.');
  assert.equal(formatContributorName('Aymé, Jean-Jacques'), 'Jean-Jacques A.');
});
