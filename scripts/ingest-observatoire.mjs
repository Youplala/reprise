#!/usr/bin/env node
// Construit le snapshot Reprise à partir de l'API GoGoCarto de l'Observatoire photo participatif.
//
//   node scripts/ingest-observatoire.mjs [--out assets/data]
//
// L'app ne doit jamais appeler l'API amont en production : elle est servie par un Apache
// sans CDN, sans gzip et en `cache-control: max-age=0, private`. On en prend un instantané
// quotidien, normalisé et versionné, que l'on publie sur un CDN.
//
// Règle non négociable : liste blanche de champs. L'API amont expose les adresses e-mail des
// contributeurs en clair (`2026_mail`, `mail`). Une liste noire laisserait passer le prochain
// champ ajouté au formulaire — la liste blanche, non. Un garde-fou en fin de course refuse
// d'écrire le fichier si une adresse a malgré tout survécu.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deliveryImageUrls } from './image-delivery.mjs';
import { SOURCE_URL } from './observatoire-source.mjs';
import { assertNoPersonalData, sanitizePublicText } from './privacy-guard.mjs';

const OFFICIAL_FICHE = 'https://observatoire-photo.paris/map#/fiche/';
const USER_AGENT = 'Reprise/1.0 (+https://github.com/Youplala/reprise) snapshot quotidien';

// Identifiants de `categoriesFull`. 3 est réutilisé pour les deux catégories 2022.
const CATEGORY = { PHOTOS_2022: 3, RECAPTURE_1970: 4, ARCHIVE_1970: 6 };

// Statuts GoGoCarto observés sur cette instance. Les valeurs négatives encodent le cycle de
// modération (supprimé / refusé / en attente) : tout ce qui n'est pas listé est écarté.
const PUBLISHED_STATUS = new Set([1, 3, 4]);

// Rayon de rattachement d'une reprise à son carré de 250 m.
const SQUARE_MATCH_RADIUS_M = 200;

// Garde-fou géographique, large à dessein : il ne s'agit pas de redécouper Paris (le `bounds`
// de leur testeur d'API ampute déjà 36 carrés à l'est), mais d'écarter les saisies aberrantes.
// Au moins une reprise est publiée avec des coordonnées en Savoie.
const PARIS_SANITY_BOUNDS = { south: 48.7, north: 49.0, west: 2.15, east: 2.55 };

function isWithinParis({ latitude, longitude }) {
  return (
    latitude >= PARIS_SANITY_BOUNDS.south &&
    latitude <= PARIS_SANITY_BOUNDS.north &&
    longitude >= PARIS_SANITY_BOUNDS.west &&
    longitude <= PARIS_SANITY_BOUNDS.east
  );
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE_METADATA_PATH = join(root, 'assets', 'data', 'paris1970-metadata.json');

function parseArgs(argv) {
  const outFlag = argv.indexOf('--out');
  return { outDir: outFlag === -1 ? 'assets/data' : argv[outFlag + 1] };
}

function categoryIdsOf(element) {
  return Array.isArray(element.categoriesFull)
    ? element.categoriesFull.map((c) => c.id).filter((id) => typeof id === 'number')
    : [];
}

function firstString(...values) {
  return values.map(sanitizePublicText).find((value) => value !== undefined);
}

function firstListedString(value) {
  return Array.isArray(value) ? firstString(...value) : firstString(value);
}

function normalizeArrondissement(value) {
  const raw = typeof value === 'number' ? String(value) : value;
  if (typeof raw !== 'string') return undefined;
  const match = raw.match(/(\d{5}|\d{1,2})/);
  if (!match) return undefined;
  const digits = match[1];
  return digits.length === 5 ? digits : `750${digits.padStart(2, '0')}`;
}

async function loadArchiveMetadata() {
  const catalog = JSON.parse(await readFile(ARCHIVE_METADATA_PATH, 'utf8'));
  if (!catalog?.documents || typeof catalog.documents !== 'object') {
    throw new Error('Catalogue paris-1970 : format inattendu');
  }

  const byDocument = new Map();
  for (const [key, metadata] of Object.entries(catalog.documents)) {
    const document = key.split('/').at(-1)?.toUpperCase();
    if (document) byDocument.set(document, metadata);
  }

  return { documents: catalog.documents, byDocument };
}

function archiveMetadataFor(fonds, document, catalog) {
  return catalog.documents[`${fonds.toUpperCase()}/${document.toUpperCase()}`];
}

function archiveMetadataFromImage(imageUrl, catalog) {
  if (!imageUrl) return undefined;
  const decoded = decodeURIComponent(imageUrl);
  const fullArk = decoded.match(/frcgmnov-751045102-la([a-j])-([ab]\d+)-v\d+/i);
  if (fullArk) {
    return archiveMetadataFor(
      `FRCGMNOV-751045102-LA${fullArk[1]}`,
      fullArk[2],
      catalog,
    );
  }

  // Quelques premiers dépôts ont gardé uniquement l'identifiant de dossier dans leur nom.
  const documentOnly = decoded.match(/(?:^|[^a-z0-9])([ab]\d+)v\d+/i);
  return documentOnly ? catalog.byDocument.get(documentOnly[1].toUpperCase()) : undefined;
}

function registerArchiveMetadata(metadata, registry, registryIndex) {
  if (!metadata) return undefined;
  const key = JSON.stringify(metadata);
  const existing = registryIndex.get(key);
  if (existing !== undefined) return existing;
  const index = registry.push(metadata) - 1;
  registryIndex.set(key, index);
  return index;
}

function metresBetween(a, b) {
  const dy = (a.latitude - b.latitude) * 111320;
  const dx = (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

function coordinateOf(element) {
  const latitude = element.geo?.latitude;
  const longitude = element.geo?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

// --- normalisation : seuls les champs listés ici sortent de la moulinette -------------------

function toStation(element, coordinate, categoryIds, archiveCatalog) {
  const isRecapture1970 = categoryIds.includes(CATEGORY.RECAPTURE_1970);
  const images = deliveryImageUrls(element.images);

  // Sur une reprise, image[0] est l'original 1970 et la dernière la reprise contemporaine.
  const referenceImage = images[0];
  const recaptureImage = images.length > 1 ? images[images.length - 1] : undefined;
  const archiveMetadata = isRecapture1970
    ? archiveMetadataFromImage(referenceImage, archiveCatalog)
    : undefined;

  return {
    id: String(element.id),
    name: firstString(element.name) ?? 'Point de vue parisien',
    coordinate,
    kind: isRecapture1970 ? 'recapture-1970' : 'station-2022',
    year: isRecapture1970 ? 1970 : 2022,
    approximate: false,
    arrondissement: normalizeArrondissement(element.arrondissement),
    address: firstString(element.address?.customFormatedAddress),
    description: firstString(element.Observation, element.textarea_1771430005812),
    // Prénom + nom : signature d'auteur publique, et obligation d'attribution ODbL.
    author: firstString(element.prenom_nom, archiveMetadata?.author),
    recaptureAuthor: firstString(element['2026_prenom_nom']),
    recaptureDevice: firstListedString(element['2026_appareil']),
    referenceMetadata: archiveMetadata,
    dateLabel: firstString(element.Date_de_prise_de_vue),
    // Date de la reprise contemporaine : c'est elle qui permet de mesurer l'activité de la
    // communauté dans le temps, la précédente datant la vue d'origine.
    recaptureDate: firstString(element['2026_date_de_prise_de_vue'])?.slice(0, 10),
    referenceImage,
    recaptureImage,
    hasRecapture: Boolean(referenceImage && recaptureImage),
    officialUrl: `${OFFICIAL_FICHE}${element.id}`,
  };
}

// `url` agrège les permaliens ARK de la BHVP, séparés par des retours à la ligne. Ce sont des
// identifiants pérennes (ARK = Archival Resource Key) : le snapshot ne contient que ces liens.
// À l'exécution, la visionneuse de la BHVP fournit les aperçus ; aucune image n'est embarquée.
//
// Stockés bruts, ces 30 156 liens pèsent 3,3 Mo à eux seuls. Ils suivent tous le même motif et
// ne référencent que 10 fonds : on les réduit à un dictionnaire + des triplets
// [indexFonds, document, vues], où `vues` est un compte quand la série est séquentielle
// (v0001..vN, le cas de 2 208 documents sur 2 211) ou la liste explicite sinon.
// Reconstruction côté app : ARK_TEMPLATE avec la vue formatée sur 4 chiffres.
const ARK_PATTERN =
  /^https:\/\/bibliotheques-specialisees\.paris\.fr\/ark:\/73873\/([^/]+)\/([^/]+)\/v(\d+)$/;
const ARK_TEMPLATE = 'https://bibliotheques-specialisees.paris.fr/ark:/73873/{fonds}/{document}/v{view}';

function toSquare(
  element,
  coordinate,
  fondsRegistry,
  archiveCatalog,
  metadataRegistry,
  metadataRegistryIndex,
) {
  const links = typeof element.url === 'string'
    ? element.url.split(/\s+/).filter((u) => u.startsWith('https://'))
    : [];

  // Regroupement par (fonds, document) en préservant l'ordre de première apparition.
  const documents = new Map();
  let unparsed = 0;

  for (const link of links) {
    const match = ARK_PATTERN.exec(link);
    if (!match) {
      unparsed += 1;
      continue;
    }
    const [, fonds, document, view] = match;
    let index = fondsRegistry.indexOf(fonds);
    if (index === -1) index = fondsRegistry.push(fonds) - 1;

    const key = `${index}/${document}`;
    // La source contient quelques permaliens répétés : un Set garde une vue = une photo.
    if (!documents.has(key)) documents.set(key, { index, document, views: new Set() });
    documents.get(key).views.add(Number(view));
  }

  const refs = [...documents.values()].map(({ index, document, views }) => {
    const sorted = [...views].sort((a, b) => a - b);
    const sequential = sorted.every((view, position) => view === position + 1);
    const metadataIndex = registerArchiveMetadata(
      archiveMetadataFor(fondsRegistry[index], document, archiveCatalog),
      metadataRegistry,
      metadataRegistryIndex,
    );
    return [
      index,
      document,
      sequential ? sorted.length : sorted,
      ...(metadataIndex === undefined ? [] : [metadataIndex]),
    ];
  });

  const photoCount = refs.reduce(
    (total, [, , views]) => total + (Array.isArray(views) ? views.length : views),
    0,
  );

  return {
    id: String(element.id),
    name: firstString(element.name) ?? String(element.id),
    coordinate,
    kind: 'archive-1970',
    year: 1970,
    approximate: true, // centroïde d'une maille de 250 m, pas un point de vue
    sheet: firstString(element.feuille),
    refs,
    photoCount,
    unparsedLinks: unparsed || undefined,
    recaptureCount: 0,
    officialUrl: `${OFFICIAL_FICHE}${element.id}`,
  };
}

// --- grille officielle de 1970 ---------------------------------------------------------------

// Le découpage réel du concours FNAC, exporté en WGS84 par le CAUE : 1 806 mailles de ~250 m.
// Sans lui, la seule option est de fabriquer une grille arbitraire, ce qui donne des mailles
// d'environ 1,1 km, soit vingt fois la surface d'un carré du concours.
//
// L'`id` du GeoJSON est un numéro d'export, pas le numéro de carré : la jointure se fait donc
// géométriquement, en cherchant le polygone qui contient le centroïde fourni par l'API. Les
// mailles étant des rectangles alignés sur les axes, leur boîte englobante EST le polygone,
// et quatre nombres suffisent à la décrire.
const GRID_GEOJSON_URL =
  'https://opppp.cartes.xyz/uploads/opppp/files/260421-export-grille-concours-1970-wsg84.geojson';

const SQUARE_SIDE_M = 250;
const INDEX_CELL_DEG = 0.01;

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

function indexKey(longitude, latitude) {
  return `${Math.floor(longitude / INDEX_CELL_DEG)}:${Math.floor(latitude / INDEX_CELL_DEG)}`;
}

async function fetchGridIndex() {
  const response = await fetch(GRID_GEOJSON_URL, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Grille officielle : HTTP ${response.status}`);

  const { features } = await response.json();
  if (!Array.isArray(features)) throw new Error('Grille officielle : GeoJSON inattendu');

  const buckets = new Map();

  for (const feature of features) {
    const ring = feature?.geometry?.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 4) continue;

    const longitudes = ring.map((point) => point[0]);
    const latitudes = ring.map((point) => point[1]);
    const box = [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    ];

    for (let x = Math.floor(box[0] / INDEX_CELL_DEG); x <= Math.floor(box[2] / INDEX_CELL_DEG); x += 1) {
      for (let y = Math.floor(box[1] / INDEX_CELL_DEG); y <= Math.floor(box[3] / INDEX_CELL_DEG); y += 1) {
        const key = `${x}:${y}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(box);
      }
    }
  }

  return { buckets, count: features.length };
}

// Repli : une maille de 250 m centrée sur le centroïde. Moins fidèle que le polygone d'origine,
// mais à la bonne échelle, ce qui est le seul point non négociable pour la lisibilité de la carte.
function fallbackBounds({ latitude, longitude }) {
  const halfLatitude = SQUARE_SIDE_M / 2 / 111320;
  const halfLongitude = halfLatitude / Math.cos((latitude * Math.PI) / 180);
  return [
    round6(longitude - halfLongitude),
    round6(latitude - halfLatitude),
    round6(longitude + halfLongitude),
    round6(latitude + halfLatitude),
  ];
}

function attachGridBounds(squares, index) {
  let matched = 0;

  for (const square of squares) {
    const { latitude, longitude } = square.coordinate;
    const candidates = index.buckets.get(indexKey(longitude, latitude)) ?? [];
    const box = candidates.find(
      ([west, south, east, north]) =>
        longitude >= west && longitude <= east && latitude >= south && latitude <= north,
    );

    if (box) {
      matched += 1;
      square.bounds = box.map(round6);
    } else {
      square.bounds = fallbackBounds(square.coordinate);
      square.approximateBounds = true;
    }
  }

  return matched;
}

// --- pipeline ------------------------------------------------------------------------------

async function main() {
  const { outDir } = parseArgs(process.argv.slice(2));

  process.stdout.write(`Lecture du catalogue descriptif paris-1970\n`);
  const archiveCatalog = await loadArchiveMetadata();

  process.stdout.write(`Lecture de ${SOURCE_URL}\n`);
  const response = await fetch(SOURCE_URL, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`API amont : HTTP ${response.status}`);

  const { data } = await response.json();
  if (!Array.isArray(data)) throw new Error('API amont : charge utile inattendue');

  const stations = [];
  const squares = [];
  const fondsRegistry = [];
  const metadataRegistry = [];
  const metadataRegistryIndex = new Map();
  const offParis = [];
  let skipped = 0;

  for (const element of data) {
    const coordinate = coordinateOf(element);
    const categoryIds = categoryIdsOf(element);

    if (!coordinate || !element.id || !PUBLISHED_STATUS.has(element.status)) {
      skipped += 1;
      continue;
    }

    if (!isWithinParis(coordinate)) {
      offParis.push({ id: String(element.id), coordinate });
      continue;
    }

    if (categoryIds.includes(CATEGORY.ARCHIVE_1970)) {
      squares.push(
        toSquare(
          element,
          coordinate,
          fondsRegistry,
          archiveCatalog,
          metadataRegistry,
          metadataRegistryIndex,
        ),
      );
    } else if (
      categoryIds.includes(CATEGORY.RECAPTURE_1970) ||
      categoryIds.includes(CATEGORY.PHOTOS_2022)
    ) {
      stations.push(toStation(element, coordinate, categoryIds, archiveCatalog));
    } else {
      skipped += 1;
    }
  }

  process.stdout.write(`Lecture de la grille officielle\n`);
  const gridIndex = await fetchGridIndex();
  const gridMatched = attachGridBounds(squares, gridIndex);

  // Rattachement des reprises 1970 à leur carré, pour la choroplèthe.
  const recaptures = stations.filter((s) => s.kind === 'recapture-1970');
  let orphanRecaptures = 0;

  for (const recapture of recaptures) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const square of squares) {
      const distance = metresBetween(recapture.coordinate, square.coordinate);
      if (distance < nearestDistance) {
        nearest = square;
        nearestDistance = distance;
      }
    }
    if (nearest && nearestDistance <= SQUARE_MATCH_RADIUS_M) nearest.recaptureCount += 1;
    else orphanRecaptures += 1;
  }

  // Quelques permaliens sont rattachés à deux mailles voisines : sommer les `photoCount`
  // compterait ces photos deux fois. Le dénominateur public doit être le nombre de vues
  // distinctes, sinon on sous-estime la couverture.
  const distinctPhotos = new Set();
  for (const square of squares) {
    for (const [index, document, views] of square.refs) {
      const list = Array.isArray(views) ? views : Array.from({ length: views }, (_, i) => i + 1);
      for (const view of list) distinctPhotos.add(`${index}/${document}/${view}`);
    }
  }

  const archivePhotos = distinctPhotos.size;
  const squaresOpened = squares.filter((square) => square.recaptureCount > 0).length;

  // Deux dénominateurs, deux vérités — et surtout pas le nombre d'éléments de l'API, qui
  // compterait les carrés comme des photos et inclurait le numérateur dans le total.
  const metrics = {
    recapturesPublished: recaptures.length,
    stations2022: stations.length - recaptures.length,
    gridSquares: squares.length,
    squaresOpened,
    archivePhotos1970: archivePhotos,
    // Ce que dessine la carte : part des carrés touchés au moins une fois.
    coverageBySquare: squares.length ? squaresOpened / squares.length : 0,
    // Ce que signifie « toutes les vues de 1970 ont été refaites ».
    coverageByPhoto: archivePhotos ? recaptures.length / archivePhotos : 0,
    orphanRecaptures,
    offParis: offParis.length,
    squaresWithOfficialBounds: gridMatched,
  };

  stations.sort((a, b) => a.id.localeCompare(b.id));
  squares.sort((a, b) => a.id.localeCompare(b.id));

  const snapshot = {
    version: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    source: {
      url: SOURCE_URL,
      name: 'Observatoire photo participatif des paysages parisiens',
      operator: 'CAUE de Paris',
      database: 'ODbL 1.0 — © les contributeurs de l’Observatoire photo participatif',
      archiveRights:
        'Fonds « C’était Paris en 1970 » — Bibliothèque historique de la Ville de Paris. ' +
        'Images chargées depuis la visionneuse BHVP par permalien ARK ; attribution dans l’application.',
    },
    archive: {
      urlTemplate: ARK_TEMPLATE,
      viewPadding: 4,
      fonds: fondsRegistry,
      metadata: metadataRegistry,
      metadataSource: 'https://framagit.org/dohseven/paris-1970',
    },
    grid: { source: GRID_GEOJSON_URL, sideMetres: SQUARE_SIDE_M, boundsOrder: ['west', 'south', 'east', 'north'] },
    metrics,
    stations,
    squares,
  };

  assertNoPersonalData(snapshot);

  const targetDir = resolve(root, outDir);
  await mkdir(targetDir, { recursive: true });
  const target = join(targetDir, 'observatoire-snapshot.json');
  await writeFile(target, `${JSON.stringify(snapshot)}\n`, 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(snapshot));
  process.stdout.write(
    [
      '',
      `  stations          ${stations.length} (dont ${recaptures.length} reprises 1970)`,
      `  carrés            ${squares.length} — ${squaresOpened} ouverts`,
      `  grille officielle ${gridMatched}/${squares.length} appariés sur ${gridIndex.count} mailles`,
      `  photos 1970       ${archivePhotos} liens ARK`,
      `  couverture carrés ${(metrics.coverageBySquare * 100).toFixed(1)} %`,
      `  couverture photos ${(metrics.coverageByPhoto * 100).toFixed(2)} %`,
      `  ignorés           ${skipped}`,
      `  hors Paris        ${offParis.length}${offParis.length ? ` (${offParis.map((e) => e.id).join(', ')})` : ''}`,
      '',
      `  → ${target} (${(bytes / 1024).toFixed(0)} Ko)`,
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  process.stderr.write(`\n${error.message}\n`);
  process.exit(1);
});
