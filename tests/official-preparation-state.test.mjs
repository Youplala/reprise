import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canReusePreparedOfficialFile,
  isAllowedOfficialReferenceUri,
  isCurrentOfficialFileMessage,
  isCurrentOfficialPreparation,
  nextOfficialTemporaryFilename,
} from '../src/services/official-preparation-state.ts';

test('ne réutilise un fichier préparé que pour la même source', () => {
  assert.equal(
    canReusePreparedOfficialFile(
      { sourceUri: 'https://example.test/archive-a.jpg' },
      'https://example.test/archive-a.jpg',
    ),
    true,
  );
  assert.equal(
    canReusePreparedOfficialFile(
      { sourceUri: 'https://example.test/archive-a.jpg' },
      'https://example.test/archive-b.jpg',
    ),
    false,
  );
  assert.equal(canReusePreparedOfficialFile(undefined, 'file:///capture.jpg'), false);
});

test('ignore le résultat asynchrone si une génération plus récente a repris la même source', () => {
  assert.equal(
    isCurrentOfficialPreparation(
      { generation: 3, key: 'station|current-a|reference-a' },
      { generation: 3, key: 'station|current-a|reference-a' },
    ),
    true,
  );
  assert.equal(
    isCurrentOfficialPreparation(
      { generation: 1, key: 'station|current-a|reference-a' },
      { generation: 3, key: 'station|current-a|reference-a' },
    ),
    false,
  );
});

test('autorise uniquement les hôtes et chemins d’images de référence connus', () => {
  assert.equal(
    isAllowedOfficialReferenceUri('https://bibliotheques-specialisees.paris.fr/in/image.jpg'),
    true,
  );
  assert.equal(
    isAllowedOfficialReferenceUri(
      'https://i0.wp.com/observatoire-photo.paris/uploads/opppp/images/elements/archive.jpg?ssl=1',
    ),
    true,
  );
  assert.equal(isAllowedOfficialReferenceUri('https://example.invalid/archive.jpg'), false);
  assert.equal(isAllowedOfficialReferenceUri('file:///private/archive.jpg'), false);
});

test('isole chaque téléchargement distant dans un fichier temporaire unique', () => {
  const first = nextOfficialTemporaryFilename('reprise-reference.jpg');
  const second = nextOfficialTemporaryFilename('reprise-reference.jpg');
  assert.notEqual(first, second);
  assert.match(first, /reprise-reference\.jpg$/);
  assert.match(second, /reprise-reference\.jpg$/);
});

test('rejette les messages provenant d’une ancienne source ou d’un ancien document WebView', () => {
  const currentRequest = { generation: 4, key: 'station|current|reference' };
  assert.equal(
    isCurrentOfficialFileMessage(
      { preparationId: '4', documentId: '7' },
      currentRequest,
      7,
    ),
    true,
  );
  assert.equal(
    isCurrentOfficialFileMessage(
      { preparationId: '3', documentId: '7' },
      currentRequest,
      7,
    ),
    false,
  );
  assert.equal(
    isCurrentOfficialFileMessage(
      { preparationId: '4', documentId: '6' },
      currentRequest,
      7,
    ),
    false,
  );
});
