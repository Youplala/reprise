import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHTML } from 'linkedom';

import {
  buildOfficialFormCompactScript,
  buildOfficialFormThemeScript,
  OFFICIAL_COMPACT_CLASS,
} from '../src/services/official-form-theme.ts';
import { buildObservatoirePrefillScript } from '../src/services/official-prefill.ts';
import { OFFICIAL_SUBMISSION_FIXTURE_HTML } from '../src/services/official-submission-fixture.ts';

const payload = {
  address: '12 rue de Rivoli',
  captureDate: '2026-08-11',
  city: 'Paris',
  device: 'iPhone 17 Pro',
  latitude: 48.856614,
  longitude: 2.352222,
  postalCode: '75004',
};

function loadFixture() {
  const { window, document } = parseHTML(OFFICIAL_SUBMISSION_FIXTURE_HTML);
  window.ReactNativeWebView = { postMessage() {} };
  window.MutationObserver = class {
    observe() {}
  };
  window.setTimeout = () => 0;
  window.clearTimeout = () => {};
  return { window, document };
}

function run(script, window, document) {
  Function('window', 'document', 'setTimeout', 'clearTimeout', 'MutationObserver', 'Event', script)(
    window,
    document,
    window.setTimeout,
    window.clearTimeout,
    window.MutationObserver,
    window.Event,
  );
}

function values(document) {
  return Array.from(document.querySelectorAll('input, textarea')).map((control) =>
    control.type === 'checkbox' || control.type === 'radio'
      ? `${control.name}:${control.checked}`
      : `${control.name}:${control.value}`,
  );
}

test('l’habillage n’ajoute ni ne modifie aucune valeur du formulaire officiel', () => {
  const { window, document } = loadFixture();
  const before = values(document);

  run(buildOfficialFormThemeScript(), window, document);
  run(buildOfficialFormThemeScript(), window, document);

  assert.deepEqual(values(document), before);
  assert.equal(document.querySelectorAll('#paris-go-theme').length, 1);
  assert.match(document.getElementById('paris-go-theme').textContent, /data-paris-go-prefilled/);
});

test('seuls les blocs remplis par Paris GO sont marqués, jamais identité, e-mail, consentement ou fichiers', () => {
  const { window, document } = loadFixture();
  run(buildObservatoirePrefillScript(payload), window, document);

  const marked = Array.from(document.querySelectorAll('[data-paris-go-prefilled]'));
  assert.ok(marked.length >= 4);

  const markedIds = marked.flatMap((container) =>
    Array.from(container.querySelectorAll('input, textarea')).map((control) => control.id),
  );
  assert.ok(markedIds.includes('fixture-address'));
  assert.ok(markedIds.includes('fixture-title'));
  assert.ok(markedIds.includes('fixture-city'));

  for (const container of marked) {
    for (const control of container.querySelectorAll('input, textarea')) {
      assert.notEqual(control.type, 'email');
      assert.notEqual(control.type, 'checkbox');
      assert.notEqual(control.type, 'file');
      assert.doesNotMatch(control.id, /identity|email|consent|age|country|residence|observations/);
    }
  }
});

test('le repli ne bascule qu’une classe sur <html>, réversible', () => {
  const { window, document } = loadFixture();
  run(buildOfficialFormCompactScript(true), window, document);
  assert.equal(document.documentElement.classList.contains(OFFICIAL_COMPACT_CLASS), true);
  run(buildOfficialFormCompactScript(false), window, document);
  assert.equal(document.documentElement.classList.contains(OFFICIAL_COMPACT_CLASS), false);
});

test('une section dont tous les champs sont remplis par Paris GO est marquée terminée, pas les autres', () => {
  const { window, document } = loadFixture();
  run(buildObservatoirePrefillScript(payload), window, document);
  run(buildOfficialFormThemeScript(), window, document);

  const sectionTitled = (title) =>
    Array.from(document.querySelectorAll('[data-paris-go-section]')).find(
      (section) => section.querySelector('h2')?.textContent.trim() === title,
    );

  assert.ok(sectionTitled('Photo de 2026')?.hasAttribute('data-paris-go-section-done'));
  assert.equal(sectionTitled('Contributeur')?.hasAttribute('data-paris-go-section-done'), false);
  assert.equal(sectionTitled('Verser la photo')?.hasAttribute('data-paris-go-section-done'), false);
});
