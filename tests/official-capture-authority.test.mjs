import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeOfficialCapture,
  isOfficialCaptureAuthorized,
} from '../src/services/official-capture-authority.ts';

test('refuse une URI de deep link qui n’a pas été autorisée par le parcours caméra', () => {
  assert.equal(isOfficialCaptureAuthorized('station-1', 'file:///cache/photo.jpg'), false);
});

test('reconnaît uniquement l’autorisation exacte créée par le parcours caméra', () => {
  authorizeOfficialCapture('station-1', 'file:///cache/photo.jpg');

  assert.equal(isOfficialCaptureAuthorized('station-1', 'file:///cache/photo.jpg'), true);
  assert.equal(isOfficialCaptureAuthorized('station-2', 'file:///cache/photo.jpg'), false);
  assert.equal(isOfficialCaptureAuthorized('station-1', 'file:///cache/photo-b.jpg'), false);
});

test('une nouvelle capture invalide l’autorisation précédente', () => {
  authorizeOfficialCapture('station-1', 'file:///cache/photo-a.jpg');
  authorizeOfficialCapture('station-1', 'file:///cache/photo-b.jpg');

  assert.equal(isOfficialCaptureAuthorized('station-1', 'file:///cache/photo-a.jpg'), false);
  assert.equal(isOfficialCaptureAuthorized('station-1', 'file:///cache/photo-b.jpg'), true);
});
