import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  HOME_LOCATION_CONTENT,
  PARIS_INITIAL_REGION,
  classifyLocationContext,
  isInParisCampaign,
  updateReturnToParisVisibility,
} from '../src/services/location-context.ts';
import {
  createUserLocationState,
  reduceUserLocationState,
} from '../src/services/user-location-state.ts';

test('classe une position précise dans Paris, hors Paris, ou absente/refusée/manuelle en exploration', () => {
  assert.equal(
    classifyLocationContext({ coordinate: { latitude: 48.8566, longitude: 2.3522 }, isPrecise: true }),
    'in-paris',
  );
  assert.equal(
    classifyLocationContext({ coordinate: { latitude: 45.764, longitude: 4.8357 }, isPrecise: true }),
    'outside-paris',
  );
  assert.equal(classifyLocationContext({ isPrecise: false }), 'browse-paris');
  assert.equal(
    classifyLocationContext({ coordinate: { latitude: 48.8566, longitude: 2.3522 }, isPrecise: false }),
    'browse-paris',
  );
  assert.equal(classifyLocationContext({ coordinate: undefined, isPrecise: true }), 'browse-paris');
});

test('suit la frontière parisienne et exclut les communes voisines prises dans son rectangle', () => {
  const examples = [
    ['Hôtel de Ville', 48.8566, 2.3522, true],
    ['bois de Boulogne', 48.8634, 2.2492, true],
    ['bois de Vincennes', 48.8348, 2.4342, true],
    ['limite officielle dans le bois de Vincennes', 48.8433778, 2.4573939, true],
    ['Boulogne-Billancourt', 48.8352, 2.2409, false],
    ['limite officielle à Issy-les-Moulineaux', 48.8343945, 2.2675555, false],
    ['Charenton-le-Pont', 48.8214, 2.413, false],
    ['Vincennes', 48.8478, 2.439, false],
  ];

  for (const [name, latitude, longitude, expected] of examples) {
    assert.equal(isInParisCampaign({ latitude, longitude }), expected, name);
  }
});

test('classe explicitement les points de la frontière administrative dans Paris', () => {
  assert.equal(isInParisCampaign({ latitude: 48.901485, longitude: 2.351984 }), true);
});

test('reste conservateur de part et d’autre des limites ouest et est', () => {
  assert.equal(isInParisCampaign({ latitude: 48.8488, longitude: 2.2555 }), true);
  assert.equal(isInParisCampaign({ latitude: 48.8488, longitude: 2.24 }), false);
  assert.equal(isInParisCampaign({ latitude: 48.8463, longitude: 2.414 }), true);
  assert.equal(isInParisCampaign({ latitude: 48.8463, longitude: 2.419 }), false);
});

test('réserve la proximité à une position précise dans Paris', () => {
  assert.deepEqual(HOME_LOCATION_CONTENT['in-paris'], {
    eyebrow: 'AUTOUR DE VOUS',
    sectionTitle: 'Photos près de vous',
    showDistances: true,
  });
  for (const context of ['outside-paris', 'browse-paris']) {
    assert.equal(HOME_LOCATION_CONTENT[context].eyebrow, 'EXPLORER PARIS');
    assert.equal(HOME_LOCATION_CONTENT[context].sectionTitle, 'Photos à Paris');
    assert.equal(HOME_LOCATION_CONTENT[context].showDistances, false);
  }
});

test('cadre Paris par défaut et retire le retour dès que la navigation revient dans Paris', () => {
  assert.deepEqual(PARIS_INITIAL_REGION, {
    latitude: 48.8607,
    longitude: 2.3476,
    latitudeDelta: 0.15,
    longitudeDelta: 0.14,
  });
  const lyon = { latitude: 45.764, longitude: 4.8357 };
  const paris = { latitude: 48.8566, longitude: 2.3522 };

  let visible = updateReturnToParisVisibility(true, lyon);
  assert.equal(visible, true, 'visible après recentrage GPS hors Paris');
  visible = updateReturnToParisVisibility(visible, paris);
  assert.equal(visible, false, 'masqué après retour du viewport à Paris');
  assert.equal(
    updateReturnToParisVisibility(true, paris),
    false,
    'masqué dès qu’une recherche navigue vers une cible parisienne',
  );
  assert.equal(
    updateReturnToParisVisibility(visible, lyon),
    false,
    'un pan ultérieur hors Paris ne réactive pas un ancien recentrage',
  );
});

test('la carte branche le cadrage parisien et le retour explicite après un recentrage hors zone', async () => {
  const source = await readFile(new URL('../src/screens/map/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /useState<Region>\(PARIS_INITIAL_REGION\)/);
  assert.match(source, /region=\{region\}/);
  assert.match(source, /setRecenteredOutsideParis\([\s\S]*?'outside-paris'/);
  assert.match(source, /accessibilityLabel="Revenir à la carte de Paris"/);
  assert.match(source, /onPress=\{handleReturnToParis\}/);
  assert.match(source, />Revenir à Paris<\/Text>/);
});

test('efface une ancienne position précise si la permission est ensuite refusée', () => {
  const preciseCoordinate = { latitude: 48.8584, longitude: 2.2945 };
  let state = createUserLocationState(
    { latitude: 48.8566, longitude: 2.3522 },
    false,
  );
  state = reduceUserLocationState(state, { type: 'success', coordinate: preciseCoordinate });
  assert.equal(state.isPrecise, true);

  state = reduceUserLocationState(state, { type: 'failure', error: 'Position non autorisée' });
  assert.equal(state.isPrecise, false);
  assert.notDeepEqual(state.coordinate, preciseCoordinate);
  assert.equal(classifyLocationContext(state), 'browse-paris');
});

test('repasse en exploration si une recherche ultérieure de position échoue', () => {
  let state = createUserLocationState(
    { latitude: 48.8566, longitude: 2.3522 },
    false,
  );
  state = reduceUserLocationState(state, {
    type: 'success',
    coordinate: { latitude: 45.764, longitude: 4.8357 },
  });
  state = reduceUserLocationState(state, { type: 'start' });
  state = reduceUserLocationState(state, { type: 'failure', error: 'Position indisponible' });

  assert.equal(state.loading, false);
  assert.equal(state.isPrecise, false);
  assert.equal(state.error, 'Position indisponible');
  assert.equal(classifyLocationContext(state), 'browse-paris');
});

test('l’accueil garde toute l’exploration accessible et ne redemande pas le GPS au rafraîchissement', async () => {
  const source = await readFile(new URL('../src/screens/home/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /classifyLocationContext/);
  assert.match(source, /HOME_LOCATION_CONTENT/);
  assert.match(source, /const handleRefresh = refresh;/);
  assert.doesNotMatch(source, /Promise\.all\(\[refresh\(\), locate\(\)\]\)/);
  assert.doesNotMatch(source, /disabled=\{awaitingFirstLocation\}/);
  assert.match(source, /La consultation fonctionne partout/);
  assert.match(source, /rendez-vous au point de\s+vue parisien/);
});

test('les reprises publiées restent indépendantes de la localisation', async () => {
  const source = await readFile(new URL('../src/screens/collective/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /const feed = publishedSubmissions/);
  assert.doesNotMatch(source, /useUserLocation|expo-location/);
});
