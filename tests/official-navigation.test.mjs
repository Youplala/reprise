import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acceptsOfficialBridgeMessage,
  isAllowedOfficialNavigation,
  officialPageKind,
  shouldInjectOfficialScripts,
} from '../src/services/official-navigation.ts';

test('la frontière WebView accepte uniquement le formulaire et sa confirmation exacts', () => {
  assert.equal(officialPageKind('https://observatoire-photo.paris/elements/add'), 'form');
  assert.equal(officialPageKind('https://observatoire-photo.paris/elements/add?draft=1'), 'form');
  assert.equal(officialPageKind('https://observatoire-photo.paris/elements/added'), 'success');
  assert.equal(officialPageKind('about:blank'), 'blank');

  for (const url of [
    'https://evil.observatoire-photo.paris/elements/add',
    'https://observatoire-photo.paris/map',
    'https://observatoire-photo.paris/other',
    'https://observatoire-photo.paris:443/elements/add',
    'https://user@observatoire-photo.paris/elements/add',
    'http://observatoire-photo.paris/elements/add',
  ]) {
    assert.equal(officialPageKind(url), 'untrusted', url);
    assert.equal(isAllowedOfficialNavigation(url), false, url);
  }
});

test('les scripts et messages natifs restent liés au formulaire de confiance', () => {
  assert.equal(shouldInjectOfficialScripts('https://observatoire-photo.paris/elements/add'), true);
  assert.equal(acceptsOfficialBridgeMessage('https://observatoire-photo.paris/elements/add'), true);
  assert.equal(shouldInjectOfficialScripts('https://observatoire-photo.paris/elements/added'), false);
  assert.equal(acceptsOfficialBridgeMessage('https://observatoire-photo.paris/elements/added'), false);
  assert.equal(shouldInjectOfficialScripts('about:blank'), false);
  assert.equal(shouldInjectOfficialScripts('about:blank', true), true);
  assert.equal(acceptsOfficialBridgeMessage('about:blank', true), true);
});
