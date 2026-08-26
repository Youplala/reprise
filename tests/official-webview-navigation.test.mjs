import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const screenSource = fs.readFileSync(
  new URL('../src/screens/official-submission/index.tsx', import.meta.url),
  'utf8',
);

test('une navigation refusée reste bloquée dans la WebView sans ouvrir Safari', () => {
  const start = screenSource.indexOf('const allowNavigation');
  const end = screenSource.indexOf('const preparedCount', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const navigationGuard = screenSource.slice(start, end);
  assert.doesNotMatch(navigationGuard, /Linking\.openURL/);
  assert.match(navigationGuard, /isAllowedOfficialNavigation\(request\.url\)/);
});

test('les nouvelles fenêtres sont interceptées sans aucune externalisation', () => {
  assert.match(screenSource, /const blockPopup = useCallback\(\(\) => undefined, \[\]\);/);
  assert.match(screenSource, /onOpenWindow=\{blockPopup\}/);

  const externalOpenCalls = screenSource.match(/Linking\.openURL/g) ?? [];
  assert.equal(externalOpenCalls.length, 0);
});

test('le commentaire public reste vide par défaut', () => {
  const start = screenSource.indexOf('const prefill = useMemo');
  const end = screenSource.indexOf('const buildInjectedScript', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const prefillPayload = screenSource.slice(start, end);
  assert.doesNotMatch(prefillPayload, /\bnote\s*:/);
  assert.doesNotMatch(prefillPayload, /referenceUrl/);
});

test('le guide de contribution peut être rouvert depuis le formulaire', () => {
  assert.match(screenSource, /<OfficialContributionGuide/);
  assert.match(screenSource, /setGuideVisible\(true\)/);
  assert.match(screenSource, /accessibilityLabel="Comprendre le dépôt"/);
});
