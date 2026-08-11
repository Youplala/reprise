import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHTML } from 'linkedom';

import {
  buildObservatoirePrefillScript,
  parseOfficialBridgeMessage,
} from '../src/services/official-prefill.ts';
import { OFFICIAL_SUBMISSION_FIXTURE_HTML } from '../src/services/official-submission-fixture.ts';

const payload = {
  address: '12 rue de Rivoli',
  captureDate: '2026-08-11',
  city: 'Paris',
  device: 'iPhone 17 Pro',
  latitude: 48.856614,
  longitude: 2.352222,
  note: 'Reprise de la vue de 1970',
  postalCode: '75004',
};

function runBridge(html, input = payload, { runTimers = false } = {}) {
  const { window, document } = parseHTML(html);
  delete window.__reprisePrefilledFields;
  delete window.__reprisePrefillSignature;
  delete window.__repriseContractSignature;
  delete window.__repriseObserver;
  const messages = [];
  const timers = [];
  window.ReactNativeWebView = {
    postMessage(value) {
      messages.push(JSON.parse(value));
    },
  };
  const setTimeoutForTest = (callback) => {
    if (runTimers) callback();
    else timers.push(callback);
    return timers.length;
  };
  const run = new Function(
    'window',
    'document',
    'MutationObserver',
    'Event',
    'setTimeout',
    'clearTimeout',
    buildObservatoirePrefillScript(input),
  );
  run(
    window,
    document,
    window.MutationObserver,
    window.Event,
    setTimeoutForTest,
    () => undefined,
  );
  return { document, messages, timers, window };
}

test('préremplit le contrat live représentatif sans toucher aux données personnelles', () => {
  const { document, messages } = runBridge(OFFICIAL_SUBMISSION_FIXTURE_HTML);

  assert.equal(document.querySelector('[name="element[fullAddress]"]').value, payload.address);
  assert.equal(document.querySelector('[name="element[name]"]').value, payload.address);
  assert.equal(document.querySelector('[name="data[fixture_arrondissement]"]').value, '75004');
  assert.equal(document.querySelector('[name="data[fixture_ville]"]').value, 'Paris');
  assert.equal(document.querySelector('[name="data[fixture_observations]"]').value, payload.note);
  assert.equal(document.querySelector('[name="data[fixture_1970_date]"]').value, '');
  assert.equal(document.querySelector('[name="data[fixture_2026_date]"]').value, '2026-08-11');
  assert.equal(document.querySelector('#fixture-2026-date-display').value, '11 août 2026');
  assert.equal(document.querySelector('[value="Smartphone"]').checked, true);
  assert.equal(document.querySelector('[name="element[geo][latitude]"]').value, '48.856614');
  assert.equal(document.querySelector('[name="element[geo][longitude]"]').value, '2.352222');

  assert.equal(document.querySelector('[name="data[fixture_identity]"]').value, '');
  assert.equal(document.querySelector('[name="data[fixture_email]"]').value, '');
  assert.equal(document.querySelector('[name="data[fixture_age]"]').value, '');
  assert.equal(document.querySelector('[name="data[fixture_country]"]').value, '');
  assert.equal(Boolean(document.querySelector('[name="data[fixture_consent]"]').checked), false);
  assert.equal(document.querySelectorAll('input[type=file]').length, 2);

  const prefill = messages.find((message) => message.type === 'prefill');
  assert.deepEqual(prefill.fields.sort(), [
    'address',
    'arrondissement',
    'captureDate',
    'city',
    'device',
    'latitude',
    'longitude',
    'note',
    'title',
  ]);
  assert.equal(prefill.count, 9);
});

test('ne remplace ni un contrôle renseigné ni un choix radio existant', () => {
  const { window, document } = parseHTML(OFFICIAL_SUBMISSION_FIXTURE_HTML);
  delete window.__reprisePrefilledFields;
  delete window.__reprisePrefillSignature;
  delete window.__repriseContractSignature;
  delete window.__repriseObserver;
  document.querySelector('[name="element[name]"]').value = 'Valeur manuelle';
  document.querySelector('[value="Appareil photo numérique"]').checked = true;

  const messages = [];
  window.ReactNativeWebView = { postMessage: (value) => messages.push(JSON.parse(value)) };
  new Function(
    'window',
    'document',
    'MutationObserver',
    'Event',
    'setTimeout',
    'clearTimeout',
    buildObservatoirePrefillScript(payload),
  )(
    window,
    document,
    window.MutationObserver,
    window.Event,
    () => 1,
    () => undefined,
  );

  assert.equal(document.querySelector('[name="element[name]"]').value, 'Valeur manuelle');
  assert.equal(document.querySelector('[value="Appareil photo numérique"]').checked, true);
  assert.equal(Boolean(document.querySelector('[value="Smartphone"]').checked), false);
  assert.equal(messages.filter((message) => message.type === 'prefill').length, 1);
});

test('signale un contrat cassé au bridge au lieu de compter un faux préremplissage', () => {
  const broken = '<html><body><form><label for="email">Mail</label><input id="email" type="email"></form></body></html>';
  const { messages } = runBridge(broken, payload, { runTimers: true });
  const error = messages.find((message) => message.type === 'contract-error');

  assert.equal(messages.some((message) => message.type === 'prefill'), false);
  assert.deepEqual(error.fields, ['title', 'arrondissement', 'city', 'captureDate', 'device']);
  assert.match(error.message, /formulaire officiel a changé/i);
});

test('le parseur accepte les erreurs de contrat et ignore les messages tiers', () => {
  assert.deepEqual(
    parseOfficialBridgeMessage(
      JSON.stringify({
        type: 'contract-error',
        fields: ['captureDate'],
        message: 'Contrat modifié',
      }),
    ),
    { type: 'contract-error', fields: ['captureDate'], message: 'Contrat modifié' },
  );
  assert.equal(parseOfficialBridgeMessage('{pas du json'), undefined);
  assert.equal(parseOfficialBridgeMessage(JSON.stringify({ type: 'tracking-event' })), undefined);
});
