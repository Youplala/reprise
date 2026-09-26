#!/usr/bin/env node
/**
 * Dessine la grille de 1970 de la page d’accueil du site à partir du relevé embarqué.
 *
 * Réécrit, dans site/index.html, le SVG situé entre les marqueurs `grille:début` et `grille:fin`,
 * ainsi que le contenu des éléments `data-stat`. Aucune image d’archive n’est utilisée : seulement
 * les emprises des carrés et leurs compteurs publics, avec les paliers de l’écran Statistiques.
 *
 * Usage : node scripts/build-site-grid.mjs [relevé] [page]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = process.argv[2] ?? path.join(root, 'assets/data/observatoire-snapshot.json');
const pagePath = process.argv[3] ?? path.join(root, 'site/index.html');

const WIDTH = 1000;
const GAP = 0.14; // part du carré laissée en blanc entre deux tuiles
const WAVES = 7; // anneaux successifs du développement, depuis l’île de la Cité
const ORIGIN = { longitude: 2.3488, latitude: 48.8534 };

// Repères placés à leurs coordonnées publiques, pour lire la forme de Paris.
const LANDMARKS = [
  { label: 'Montmartre', longitude: 2.3431, latitude: 48.8867, anchor: 'start' },
  { label: 'Tour Eiffel', longitude: 2.2945, latitude: 48.8584, anchor: 'end' },
  { label: 'Notre-Dame', longitude: 2.3499, latitude: 48.853, anchor: 'end', minor: true },
  { label: 'Bastille', longitude: 2.3691, latitude: 48.8532, anchor: 'start', minor: true },
];

// Mêmes seuils que squareDistribution (src/utils/community-stats.ts).
export function squareBucket(square) {
  const ratio = square.photoCount ? square.recaptureCount / square.photoCount : 0;
  if (ratio <= 0) return 'untouched';
  if (ratio < 0.25) return 'started';
  if (ratio < 1) return 'halfway';
  return 'complete';
}

const BUCKETS = ['untouched', 'started', 'halfway', 'complete'];

const formatter = new Intl.NumberFormat('fr-FR');
function formatNumber(value) {
  // Espace fine insécable, comme dans l’application.
  return formatter.format(value).replace(/\s/g, ' ');
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${day === 1 ? '1er' : day} ${months[month - 1]} ${year}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

export function buildGrid(snapshot) {
  const squares = snapshot.squares.filter((square) => Array.isArray(square.bounds));
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [w, s, e, n] of squares.map((square) => square.bounds)) {
    west = Math.min(west, w);
    south = Math.min(south, s);
    east = Math.max(east, e);
    north = Math.max(north, n);
  }

  // Équirectangulaire local : suffisant à l’échelle de Paris.
  const cosLat = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = WIDTH / ((east - west) * cosLat);
  const height = Math.ceil((north - south) * scale);
  const project = (longitude, latitude) => [(longitude - west) * cosLat * scale, (north - latitude) * scale];

  const [originX, originY] = project(ORIGIN.longitude, ORIGIN.latitude);
  const tiles = squares.map((square) => {
    const [w, s, e, n] = square.bounds;
    const [x0, y0] = project(w, n);
    const [x1, y1] = project(e, s);
    const inset = ((x1 - x0) * GAP) / 2;
    const x = x0 + inset;
    const y = y0 + inset;
    const size = Math.min(x1 - x0, y1 - y0) - 2 * inset;
    const distance = Math.hypot((x0 + x1) / 2 - originX, (y0 + y1) / 2 - originY);
    return { x, y, size, distance, bucket: squareBucket(square) };
  });

  const maxDistance = Math.max(...tiles.map((tile) => tile.distance));
  const layers = new Map();
  for (const tile of tiles) {
    const wave = Math.min(WAVES - 1, Math.floor((tile.distance / maxDistance) * WAVES));
    const key = `${tile.bucket}-${wave}`;
    const d = `M${round(tile.x)} ${round(tile.y)}h${round(tile.size)}v${round(tile.size)}h-${round(tile.size)}z`;
    layers.set(key, (layers.get(key) ?? '') + d);
  }

  const paths = [];
  for (let wave = 0; wave < WAVES; wave += 1) {
    for (const bucket of BUCKETS) {
      const d = layers.get(`${bucket}-${wave}`);
      if (d) paths.push(`<path class="t-${bucket} w${wave}" d="${d}"/>`);
    }
  }

  const labels = LANDMARKS.map(({ label, longitude, latitude, anchor, minor }) => {
    const [x, y] = project(longitude, latitude);
    const dx = anchor === 'end' ? -10 : 10;
    return `<g class="landmark${minor ? ' minor' : ''}"><circle cx="${round(x)}" cy="${round(y)}" r="4"/><text x="${round(x + dx)}" y="${round(y + 4.5)}" text-anchor="${anchor}">${label}</text></g>`;
  });

  const counts = Object.fromEntries(BUCKETS.map((bucket) => [bucket, tiles.filter((tile) => tile.bucket === bucket).length]));
  const svg = [
    `<svg class="grid-map" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="grille-titre grille-desc">`,
    `<title id="grille-titre">La grille du concours de 1970, carré par carré</title>`,
    `<desc id="grille-desc">${formatNumber(tiles.length)} carrés de 250 mètres référencés par l’Observatoire : ${formatNumber(counts.untouched)} sans photo refaite, ${formatNumber(counts.started)} commencés, ${formatNumber(counts.halfway)} bien avancés et ${formatNumber(counts.complete)} terminés, au ${formatDate(snapshot.version)}.</desc>`,
    `<g class="tiles">${paths.join('')}</g>`,
    `<g class="landmarks" aria-hidden="true">${labels.join('')}</g>`,
    `</svg>`,
  ].join('\n');

  const metrics = snapshot.metrics;
  const stats = {
    date: formatDate(snapshot.version),
    squares: formatNumber(metrics.gridSquares),
    opened: formatNumber(metrics.squaresOpened),
    recaptures: formatNumber(metrics.recapturesPublished),
    photos1970: formatNumber(metrics.archivePhotos1970),
    'percent-photos': `${formatNumber(Math.round(metrics.coverageByPhoto * 1000) / 10)} %`,
    untouched: formatNumber(counts.untouched),
    started: formatNumber(counts.started),
    halfway: formatNumber(counts.halfway),
    complete: formatNumber(counts.complete),
  };
  return { svg, stats };
}

export function applyGrid(html, { svg, stats }) {
  const markers = /(<!-- grille:début -->)[\s\S]*?(<!-- grille:fin -->)/;
  if (!markers.test(html)) throw new Error('Marqueurs grille:début / grille:fin introuvables.');
  let output = html.replace(markers, (_, start, end) => `${start}\n${svg}\n${end}`);
  output = output.replace(/(<([a-z]+)[^>]*\bdata-stat="([a-z0-9-]+)"[^>]*>)[^<]*(<\/\2>)/g, (match, open, _tag, key, close) => {
    if (!(key in stats)) throw new Error(`Statistique inconnue : ${key}`);
    return `${open}${stats[key]}${close}`;
  });
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const html = fs.readFileSync(pagePath, 'utf8');
  const next = applyGrid(html, buildGrid(snapshot));
  fs.writeFileSync(pagePath, next);
  console.log(`Grille du ${snapshot.version} écrite dans ${path.relative(root, pagePath)}.`);
}
