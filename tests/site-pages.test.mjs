import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyGrid, buildGrid, squareBucket } from '../scripts/build-site-grid.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const pages = [
  ['/', 'index.html'],
  ['/support/', 'support/index.html'],
  ['/confidentialite/', 'confidentialite/index.html'],
  ['/conditions/', 'conditions/index.html'],
  ['/sources/', 'sources/index.html'],
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('publie toutes les pages requises par la fiche App Store', () => {
  for (const [route, relativePath] of pages) {
    const html = read(`site/${relativePath}`);
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, new RegExp(`https://youplala\\.github\\.io/reprise${route.replaceAll('/', '\\/')}`));
  }
});

test('résout chaque lien interne vers un fichier du site', () => {
  for (const [, relativePath] of pages) {
    const html = read(`site/${relativePath}`);
    const links = [...html.matchAll(/(?:href|src)="([^"#?]+)"/g)]
      .map((match) => match[1])
      .filter((link) => !/^(?:https?:|mailto:|tel:)/.test(link));
    const pageDirectory = path.dirname(path.join(site, relativePath));
    for (const link of links) {
      const candidate = link.startsWith('/reprise/')
        ? path.join(site, decodeURIComponent(link.slice('/reprise/'.length)))
        : path.resolve(pageDirectory, decodeURIComponent(link));
      const resolved = link.endsWith('/') ? path.join(candidate, 'index.html') : candidate;
      assert.ok(fs.existsSync(resolved), `${relativePath}: ${link} ne résout pas vers ${resolved}`);
    }
  }
});

test('la confidentialité décrit le traitement local et le dépôt tiers manuel', () => {
  const privacy = read('site/confidentialite/index.html');
  assert.match(privacy, /sans compte/);
  assert.match(privacy, /photothèque en ajout uniquement/);
  assert.match(privacy, /Le commentaire public reste vide/);
  assert.match(privacy, /Aucun dépôt n’est automatique/);
  assert.match(privacy, /transmises directement à l’Observatoire/);
  assert.match(privacy, /OpenStreetMap/);
  assert.match(privacy, /Automattic/);
  assert.match(privacy, /mailto:eliebrosset@gmail\.com/);
});

test('ne charge aucune ressource tierce', () => {
  for (const [, relativePath] of [...pages, [null, '404.html']]) {
    const html = read(`site/${relativePath}`);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, relativePath);
    const resources = [
      ...html.matchAll(/<link\b[^>]*\brel="(?:stylesheet|preload|icon|apple-touch-icon)"[^>]*>/g),
      ...html.matchAll(/<(?:script|img)\b[^>]*\bsrc="[^"]*"[^>]*>/g),
    ].map((match) => match[0].match(/(?:href|src)="([^"]*)"/)[1]);
    for (const resource of resources) {
      assert.doesNotMatch(resource, /^(?:https?:)?\/\//, `${relativePath}: ${resource}`);
    }
  }
});

test('les textes publics ne décrivent plus de capteur d’orientation', () => {
  const files = [
    ...pages.map(([, relativePath]) => `site/${relativePath}`),
    'docs/CONFIDENTIALITE.md',
    'docs/PUBLICATION.md',
    'store.config.json',
    'docs/app-review/REPONSE-APP-STORE-CONNECT.md',
    'docs/app-review/SCRIPT-ENREGISTREMENT.md',
  ];
  for (const file of files) {
    const text = read(file);
    assert.doesNotMatch(text, /orientation du téléphone|inclinaison|tilt guide|motion permission|motion prompt|l’orientation sont demandées/i, file);
  }
});

test('la grille de l’accueil suit les paliers de l’écran Statistiques', () => {
  const square = (photoCount, recaptureCount) => ({ photoCount, recaptureCount });
  assert.equal(squareBucket(square(0, 0)), 'untouched');
  assert.equal(squareBucket(square(8, 0)), 'untouched');
  assert.equal(squareBucket(square(8, 1)), 'started');
  assert.equal(squareBucket(square(8, 2)), 'halfway');
  assert.equal(squareBucket(square(8, 8)), 'complete');

  const snapshot = JSON.parse(read('assets/data/observatoire-snapshot.json'));
  const grid = buildGrid(snapshot);
  const tiles = [...grid.svg.matchAll(/M[\d.]+ [\d.]+h/g)].length;
  assert.equal(tiles, snapshot.squares.filter((entry) => Array.isArray(entry.bounds)).length);
  assert.doesNotMatch(grid.svg, /https?:\/\/(?!www\.w3\.org)/);

  // La page publiée contient une grille générée par le script, sans exiger le relevé du jour.
  const html = read('site/index.html');
  assert.match(html, /<!-- grille:début -->\n<svg class="grid-map"[\s\S]*<\/svg>\n<!-- grille:fin -->/);
  const regenerated = applyGrid(html, grid);
  const keys = (page) => [...page.matchAll(/data-stat="([a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(keys(regenerated), keys(html));
});

test('propose un canal d’assistance privé', () => {
  const support = read('site/support/index.html');
  assert.match(support, /mailto:eliebrosset@gmail\.com/);
  assert.match(support, /Assistance privée/);
});

test('les métadonnées Apple pointent vers les pages GitHub Pages', () => {
  const config = JSON.parse(read('store.config.json'));
  const info = config.apple.info['fr-FR'];
  assert.equal(info.marketingUrl, 'https://youplala.github.io/reprise/');
  assert.equal(info.supportUrl, 'https://youplala.github.io/reprise/support/');
  assert.equal(info.privacyPolicyUrl, 'https://youplala.github.io/reprise/confidentialite/');
});

test('le workflow publie uniquement le répertoire statique site', () => {
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /path: site/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
