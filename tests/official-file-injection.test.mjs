import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHTML } from 'linkedom';

import {
  buildObservatoireFileCleanupScript,
  buildObservatoireFileInjectionScript,
} from '../src/services/official-file-injection.ts';
import { OFFICIAL_SUBMISSION_FIXTURE_HTML } from '../src/services/official-submission-fixture.ts';

const files = {
  reference: {
    base64: '/9j/4AAQ',
    filename: 'reprise-archive.jpg',
    mimeType: 'image/jpeg',
    size: 6,
  },
  current: {
    base64: 'iVBORw0KGgo=',
    filename: 'reprise-2026.png',
    mimeType: 'image/png',
    size: 8,
  },
};

class TestFile {
  constructor(parts, name, options) {
    this.parts = parts;
    this.name = name;
    this.type = options.type;
    this.lastModified = options.lastModified ?? 0;
    this.size = parts.reduce((sum, part) => sum + part.length, 0);
  }
}

class TestDataTransfer {
  constructor() {
    const entries = [];
    this.items = { add: (file) => entries.push(file) };
    this.files = entries;
  }
}

function runInjection(html, payload = files, preparationId = '1', documentId = '1') {
  const { window, document } = parseHTML(html);
  window.__repriseLatestPreparationId = undefined;
  window.__repriseOwnedFiles = undefined;
  window.__repriseFileSignature = undefined;
  window.__repriseFilesReadySignature = undefined;
  window.__repriseFileError = undefined;
  const messages = [];
  window.ReactNativeWebView = {
    postMessage(value) {
      messages.push(JSON.parse(value));
    },
  };
  window.atob = (value) => Buffer.from(value, 'base64').toString('binary');

  new Function(
    'window',
    'document',
    'File',
    'DataTransfer',
    'Event',
    buildObservatoireFileInjectionScript(payload, preparationId, documentId),
  )(window, document, TestFile, TestDataTransfer, window.Event);

  return { document, messages };
}

function injectionSession(html = OFFICIAL_SUBMISSION_FIXTURE_HTML) {
  const { window, document } = parseHTML(html);
  window.__repriseLatestPreparationId = undefined;
  window.__repriseOwnedFiles = undefined;
  window.__repriseFileSignature = undefined;
  window.__repriseFilesReadySignature = undefined;
  window.__repriseFileError = undefined;
  const messages = [];
  window.ReactNativeWebView = { postMessage: (value) => messages.push(JSON.parse(value)) };
  window.atob = (value) => Buffer.from(value, 'base64').toString('binary');
  const execute = (payload, preparationId = '1', documentId = '1') => new Function(
    'window', 'document', 'File', 'DataTransfer', 'Event',
    buildObservatoireFileInjectionScript(payload, preparationId, documentId),
  )(window, document, TestFile, TestDataTransfer, window.Event);
  const cleanup = (preparationId = '2') => new Function(
    'window', 'document',
    buildObservatoireFileCleanupScript(preparationId),
  )(window, document);
  return { cleanup, document, execute, messages, window };
}

test('injecte automatiquement les deux images dans la collection multipart GoGoCarto', () => {
  const { document, messages } = runInjection(OFFICIAL_SUBMISSION_FIXTURE_HTML);
  const inputs = [...document.querySelectorAll('.new-file-fields-list.images input[type=file]')];

  assert.equal(inputs.length, 2);
  assert.deepEqual(inputs.map((input) => input.name), [
    'element[images][0][file][file]',
    'element[images][1][file][file]',
  ]);
  assert.deepEqual(inputs.map((input) => input.files[0].name), [
    'reprise-archive.jpg',
    'reprise-2026.png',
  ]);
  assert.deepEqual(inputs.map((input) => input.files[0].type), ['image/jpeg', 'image/png']);
  assert.deepEqual(messages.find((message) => message.type === 'files-ready'), {
    type: 'files-ready',
    count: 2,
    files: ['reference', 'current'],
    preparationId: '1',
    documentId: '1',
  });
});

test('reconnaît le formulaire officiel réel sans identifiant par son uploader exact', () => {
  const liveForm = OFFICIAL_SUBMISSION_FIXTURE_HTML.replace(
    '<form class="legacy-form-shell" id="fixture-form">',
    '<form class="keep-data 2022">',
  );
  const { document, messages } = runInjection(liveForm);
  const inputs = [...document.querySelectorAll('[data-reprise-upload="1"] input[type=file]')];

  assert.deepEqual(inputs.map((input) => input.files[0].name), [
    'reprise-archive.jpg',
    'reprise-2026.png',
  ]);
  assert.equal(messages.some((message) => message.type === 'files-error'), false);
});

test('reste idempotent lors des réinjections WebView', () => {
  const { window, document } = parseHTML(OFFICIAL_SUBMISSION_FIXTURE_HTML);
  const messages = [];
  window.ReactNativeWebView = { postMessage: (value) => messages.push(JSON.parse(value)) };
  delete window.__repriseFileSignature;
  delete window.__repriseFilesReadySignature;
  delete window.__repriseFileError;
  window.atob = (value) => Buffer.from(value, 'base64').toString('binary');
  const execute = () => new Function(
    'window', 'document', 'File', 'DataTransfer', 'Event',
    buildObservatoireFileInjectionScript(files, '1', '1'),
  )(window, document, TestFile, TestDataTransfer, window.Event);

  execute();
  execute();

  assert.equal(document.querySelectorAll('.new-file-fields-list.images input[type=file]').length, 2);
  assert.equal(messages.filter((message) => message.type === 'files-ready').length, 1);
});

test('réémet l’état prêt pour le nouveau document sans recréer les fichiers', () => {
  const session = injectionSession();
  session.execute(files, '4', '1');
  const inputs = [...session.document.querySelectorAll('[data-reprise-upload="1"] input[type=file]')];
  session.execute(files, '4', '2');

  assert.deepEqual(
    session.messages
      .filter((message) => message.type === 'files-ready')
      .map((message) => message.documentId),
    ['1', '2'],
  );
  assert.deepEqual(
    [...session.document.querySelectorAll('[data-reprise-upload="1"] input[type=file]')],
    inputs,
  );
});

test('remplace des fichiers de même nom et même taille lorsque leurs octets changent', () => {
  const session = injectionSession();
  session.execute(files);
  const replacement = {
    reference: { ...files.reference, base64: '/9j/4AAR' },
    current: { ...files.current, base64: 'iVBORw0KGhE=' },
  };

  session.execute(replacement);

  const inputs = [...session.document.querySelectorAll('.new-file-fields-list.images input[type=file]')];
  assert.deepEqual(
    inputs.map((input) => Buffer.from(input.files[0].parts[0]).toString('base64')),
    [replacement.reference.base64, replacement.current.base64],
  );
  assert.equal(session.messages.some((message) => message.type === 'files-error'), false);
});

test('retire immédiatement les fichiers encore détenus par Reprise quand la source change', () => {
  const session = injectionSession();
  session.execute(files);

  session.cleanup();

  assert.equal(session.document.querySelectorAll('[data-reprise-upload="1"]').length, 0);
  assert.equal(session.document.querySelectorAll('.new-file-fields-list.images input[type=file]').length, 0);
});

test('préserve un fichier remplacé manuellement lors du nettoyage et des réinjections', () => {
  const session = injectionSession();
  session.execute(files);
  const current = session.document.querySelector('[data-reprise-kind="current"] input[type=file]');
  const injected = current.files[0];
  const manual = new TestFile([new Uint8Array(injected.size)], injected.name, {
    type: injected.type,
    lastModified: injected.lastModified,
  });
  current.files = [manual];

  session.cleanup();
  session.execute(
    {
      ...files,
      current: { ...files.current, base64: 'iVBORw0KGhE=' },
    },
    '2',
  );

  assert.equal(current.files[0], manual);
  assert.equal(current.closest('[data-reprise-upload="1"]'), null);
  assert.match(
    session.messages.findLast((message) => message.type === 'files-error').message,
    /choisies manuellement/i,
  );
});

test('ignore un ancien script et un ancien message après changement de génération', () => {
  const session = injectionSession();
  session.cleanup('2');
  session.execute(files, '1');

  assert.equal(session.document.querySelectorAll('[data-reprise-upload="1"]').length, 0);
  assert.equal(session.messages.some((message) => message.preparationId === '1'), false);
});

test('un ancien cleanup ne peut pas rétrograder la génération ni restaurer ses fichiers', () => {
  const session = injectionSession();
  const latest = {
    reference: { ...files.reference, base64: '/9j/4AAR' },
    current: { ...files.current, base64: 'iVBORw0KGhE=' },
  };
  session.execute(latest, '2', '4');
  session.cleanup('1');
  session.execute(files, '1', '3');

  const inputs = [...session.document.querySelectorAll('[data-reprise-upload="1"] input[type=file]')];
  assert.equal(session.window.__repriseLatestPreparationId, '2');
  assert.deepEqual(
    inputs.map((input) => Buffer.from(input.files[0].parts[0]).toString('base64')),
    [latest.reference.base64, latest.current.base64],
  );
});

test('échoue fermé si le contrat multipart GoGoCarto a dérivé', () => {
  const broken = OFFICIAL_SUBMISSION_FIXTURE_HTML.replace(
    'element[images][__count__][file][file]',
    'element[documents][__count__]',
  );
  const { document, messages } = runInjection(broken);

  assert.equal(document.querySelectorAll('.new-file-fields-list.images input[type=file]').length, 0);
  const error = messages.find((message) => message.type === 'files-error');
  assert.match(error.message, /uploader officiel a changé/i);
});

test('refuse un fichier incomplet ou d’un type non autorisé avant toute injection', () => {
  const invalid = {
    ...files,
    current: { ...files.current, mimeType: 'image/heic' },
  };
  const { document, messages } = runInjection(OFFICIAL_SUBMISSION_FIXTURE_HTML, invalid);

  assert.equal(document.querySelectorAll('.new-file-fields-list.images input[type=file]').length, 0);
  assert.equal(messages.some((message) => message.type === 'files-error'), true);
});
