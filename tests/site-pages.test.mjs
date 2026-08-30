import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
