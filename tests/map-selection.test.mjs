import assert from 'node:assert/strict';
import test from 'node:test';

import { retainExplicitMapSelection } from '../src/utils/map-selection.ts';

const station = (id, approximate = false, revision = 'current') => ({
  id,
  approximate,
  revision,
});

test('conserve le pin choisi quand seul le filtre texte du secteur l’exclut', () => {
  const selected = station('photo-exacte-786');
  const filteredByQuery = [station('autre-photo')];

  assert.deepEqual(
    retainExplicitMapSelection(filteredByQuery, selected.id, [selected, ...filteredByQuery], 3),
    [selected, filteredByQuery[0]],
  );
});

test('ne duplique pas une sélection déjà visible et respecte la limite', () => {
  const selected = station('photo-b');
  const visible = [station('photo-a'), selected, station('photo-c')];

  assert.deepEqual(
    retainExplicitMapSelection(visible, selected.id, visible, 2),
    visible.slice(0, 2),
  );
});

test('conserve la sélection même lorsqu’elle se trouvait après la limite', () => {
  const visible = Array.from({ length: 81 }, (_, index) => station(`photo-${index}`));
  const selected = visible[80];
  const result = retainExplicitMapSelection(visible, selected.id, visible, 80);

  assert.equal(result.length, 80);
  assert.equal(result[0], selected);
});

test('ne contourne pas un filtre de statut actif', () => {
  const selected = station('photo-refaite');
  const eligibleForCurrentFilter = [station('photo-a-retrouver')];

  assert.deepEqual(
    retainExplicitMapSelection([], selected.id, eligibleForCurrentFilter, 80),
    [],
  );
});

test('résout la sélection depuis les données fraîches du provider', () => {
  const stale = station('photo-786', false, 'stale');
  const current = station('photo-786', false, 'current');

  assert.deepEqual(retainExplicitMapSelection([], stale.id, [current], 80), [current]);
  assert.deepEqual(retainExplicitMapSelection([], stale.id, [], 80), []);
});

test('ne force pas une archive approximative dans la liste des pins exacts', () => {
  const visible = [station('photo-a')];
  const approximate = station('secteur-786', true);

  assert.deepEqual(
    retainExplicitMapSelection(visible, approximate.id, [approximate, ...visible], 3),
    visible,
  );
});
