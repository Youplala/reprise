import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { OFFICIAL_CONTRIBUTION_GUIDE } from '../src/services/official-contribution-guide.ts';
import { createOfficialContributionGuideStorage } from '../src/services/official-contribution-guide-storage.ts';

const componentSource = fs.readFileSync(
  new URL('../src/components/official-contribution-guide.tsx', import.meta.url),
  'utf8',
);

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

test('ne promet jamais que Paris GO remplit ou envoie les données personnelles', () => {
  const copy = JSON.stringify(OFFICIAL_CONTRIBUTION_GUIDE).toLocaleLowerCase('fr');
  assert.doesNotMatch(copy, /identité (préremplie|automatique)/);
  assert.doesNotMatch(copy, /envoi automatique/);
});

test('reste entièrement accessible sur un petit écran ou avec une grande police', () => {
  assert.match(componentSource, /<ScrollView/);
  assert.match(componentSource, /maxHeight: '100%'/);
});

test('une lecture tardive ne rouvre pas le guide après sa fermeture', async () => {
  let resolveRead;
  const storage = createOfficialContributionGuideStorage(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    async () => undefined,
  );

  const pendingRead = storage.shouldShow();
  await storage.markSeen();
  resolveRead(null);

  assert.equal(await pendingRead, false);
  assert.equal(await storage.shouldShow(), false);
});

test('la fermeture reste acquise pendant une écriture lente', async () => {
  let resolveWrite;
  const storage = createOfficialContributionGuideStorage(
    async () => null,
    () =>
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
  );

  const pendingWrite = storage.markSeen();
  assert.equal(await storage.shouldShow(), false);
  resolveWrite();
  await pendingWrite;
});
