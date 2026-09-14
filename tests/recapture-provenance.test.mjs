import assert from 'node:assert/strict';
import test from 'node:test';
import * as provenance from '../src/utils/recapture-provenance.ts';

test('détecte la mention Paris GO sans confondre un autre mot ou un auteur', () => {
  assert.equal(typeof provenance.isParisGoRecapture, 'function');
  for (const description of ['Photo refaite avec Paris GO.', 'Avec paris\u00a0go !', 'PARIS  GO']) {
    assert.equal(provenance.isParisGoRecapture({ id: 'new', hasRecapture: true, description }), true);
  }
  for (const description of [undefined, '', 'Paris golf', 'GrandParis GO', 'paris google']) {
    assert.equal(provenance.isParisGoRecapture({ id: 'new', hasRecapture: true, description, currentAuthor: 'Elie B.' }), false);
  }
  assert.equal(provenance.isParisGoRecapture({ id: 'new', hasRecapture: false, description: 'Paris GO' }), false);
});

test('reconnaît uniquement les deux anciennes reprises confirmées avant la signature', () => {
  assert.equal(typeof provenance.isParisGoRecapture, 'function');
  for (const id of ['1h3', '1mv']) {
    assert.equal(provenance.isParisGoRecapture({ id, hasRecapture: true }), true);
  }
  assert.equal(provenance.isParisGoRecapture({ id: '1h4', hasRecapture: true }), false);
});
