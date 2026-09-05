import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildPhotoReportDraft,
  launchPhotoReport,
} from '../src/utils/photo-report.ts';

test('prépare un brouillon mailto éditable avec les informations du signalement encodées', () => {
  const draft = buildPhotoReportDraft({
    title: 'Place d’Italie & alentours',
    stationId: 'station 42',
    officialUrl: 'https://observatoire-photo.paris/fiche?id=42&view=current',
  });

  assert.equal(draft.recipient, 'observatoire-photo@caue75.fr');
  assert.equal(draft.subject, 'Signalement d’une photo refaite · Place d’Italie & alentours');
  assert.match(draft.body, /identifiant station 42/);
  assert.match(draft.body, /Fiche : https:\/\/observatoire-photo\.paris\/fiche\?id=42&view=current/);
  assert.match(draft.body, /Problème constaté : $/);
  assert.equal(
    draft.mailto,
    `mailto:${draft.recipient}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`,
  );

  const parsed = new URL(draft.mailto);
  assert.equal(parsed.searchParams.get('subject'), draft.subject);
  assert.equal(parsed.searchParams.get('body'), draft.body);
});

test('le repli expose les champs utiles sans donnée personnelle ni envoi automatique', () => {
  const draft = buildPhotoReportDraft({
    title: 'Photo test',
    stationId: undefined,
    officialUrl: undefined,
  });

  assert.match(draft.fallbackMessage, /Destinataire : observatoire-photo@caue75\.fr/);
  assert.match(draft.fallbackMessage, /Sujet : Signalement d’une photo refaite · Photo test/);
  assert.match(draft.fallbackMessage, /Identifiant : inconnu/);
  assert.match(draft.fallbackMessage, /Fiche officielle : https:\/\/observatoire-photo\.paris\/map/);
  assert.match(draft.fallbackMessage, /Problème constaté :/);
  assert.doesNotMatch(draft.body, /nom|prénom|téléphone|adresse personnelle/i);
  assert.doesNotMatch(draft.fallbackMessage, /nom|prénom|téléphone|adresse personnelle/i);
});

test('ouvre le brouillon éditable lorsque mailto est disponible', async () => {
  const calls = [];
  const result = await launchPhotoReport('mailto:test@example.com', {
    canOpenURL: async (url) => {
      calls.push(['canOpenURL', url]);
      return true;
    },
    openURL: async (url) => {
      calls.push(['openURL', url]);
    },
  });

  assert.equal(result, 'opened');
  assert.deepEqual(calls, [
    ['canOpenURL', 'mailto:test@example.com'],
    ['openURL', 'mailto:test@example.com'],
  ]);
});

test('retourne le repli sans ouvrir de lien lorsque mailto est indisponible', async () => {
  let opened = false;
  const result = await launchPhotoReport('mailto:test@example.com', {
    canOpenURL: async () => false,
    openURL: async () => {
      opened = true;
    },
  });

  assert.equal(result, 'fallback');
  assert.equal(opened, false);
});

test('retourne le repli lorsque openURL rejette', async () => {
  const result = await launchPhotoReport('mailto:test@example.com', {
    canOpenURL: async () => true,
    openURL: async () => {
      throw new Error('Mail indisponible');
    },
  });

  assert.equal(result, 'fallback');
});

test('retourne aussi le repli lorsque la vérification mailto échoue', async () => {
  const result = await launchPhotoReport('mailto:test@example.com', {
    canOpenURL: async () => {
      throw new Error('Vérification impossible');
    },
    openURL: async () => assert.fail('openURL ne doit pas être appelé'),
  });

  assert.equal(result, 'fallback');
});

test('l’écran conserve la confirmation et affiche un repli natif partageable', () => {
  const screenSource = readFileSync(
    new URL('../src/screens/station/index.tsx', import.meta.url),
    'utf8',
  );

  assert.match(screenSource, /buildPhotoReportDraft\(\{/);
  assert.match(screenSource, /launchPhotoReport\(draft\.mailto, Linking\)/);
  assert.match(screenSource, /'Un brouillon d’email va être préparé/);
  assert.match(screenSource, /'Email indisponible'/);
  assert.match(screenSource, /draft\.fallbackMessage/);
  assert.match(screenSource, /Share\.share\(\{[\s\S]*message: draft\.fallbackMessage/);
  assert.doesNotMatch(screenSource, /void Linking\.openURL\(mailto\)/);
});
