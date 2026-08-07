#!/usr/bin/env node
// Extrait le petit catalogue descriptif du projet paris-1970 de Jean Thouny sans recopier
// ses images. Les valeurs proviennent des notices EAD de la BHVP que son script a normalisées
// dans un `candidate.json` par dossier photographique.
//
//   node scripts/import-paris1970-metadata.mjs /chemin/vers/paris-1970

// Le fichier généré est versionné : l'action quotidienne peut ainsi enrichir le snapshot sans
// cloner 1,2 Go ni dépendre du dépôt Framagit à chaque exécution.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_URL = 'https://framagit.org/dohseven/paris-1970';
const ARK_PATTERN = /\/ark:\/73873\/([^/]+)\/([^/]+)\/v\d+$/i;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function findCandidateFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findCandidateFiles(path)));
    else if (entry.name === 'candidate.json') files.push(path);
  }

  return files;
}

function strings(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function decodeXmlText(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(x?)([0-9a-f]+);/gi, (_, hexadecimal, number) =>
      String.fromCodePoint(Number.parseInt(number, hexadecimal ? 16 : 10)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function elementText(xml, tag, attributePattern = '') {
  const match = xml.match(
    new RegExp(`<${tag}\\b${attributePattern}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  );
  return match ? decodeXmlText(match[1]) : undefined;
}

async function readEadMetadata(sourceRoot) {
  const directory = join(sourceRoot, 'input_data', 'carres');
  const files = (await readdir(directory)).filter((name) => name.endsWith('.xml'));
  const documents = new Map();

  for (const name of files) {
    const xml = await readFile(join(directory, name), 'utf8');
    const fonds = elementText(xml, 'eadid')?.replace(/\.xml$/i, '').toUpperCase();
    if (!fonds) continue;

    for (const match of xml.matchAll(/<c\b([^>]*\blevel="item"[^>]*)>([\s\S]*?)<\/c>/gi)) {
      const document = match[1].match(/\bid="([^"]+)"/i)?.[1]?.toUpperCase();
      if (!document) continue;
      const body = match[2];
      const scope = body.match(/<scopecontent\b[^>]*>([\s\S]*?)<\/scopecontent>/i)?.[1] ?? '';
      const notes = [];

      for (const paragraph of scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
        const paragraphXml = paragraph[1];
        const text = decodeXmlText(paragraphXml);
        const locations = [...paragraphXml.matchAll(/<geogname\b[^>]*>([\s\S]*?)<\/geogname>/gi)]
          .map((location) => decodeXmlText(location[1]));
        const isOnlyLocations = locations.length > 0 && text === locations.join(' ');
        if (!text || isOnlyLocations || /^Candidat n[°o]\s*\d+\s*$/i.test(text)) continue;
        notes.push(text);
      }

      documents.set(`${fonds}/${document}`, {
        callNumber: elementText(body, 'unitid'),
        technique:
          elementText(body, 'physfacet', '[^>]*type="technique"') ??
          elementText(body, 'physfacet', '[^>]*type="support"'),
        extent: elementText(body, 'extent'),
        dimensions: elementText(body, 'dimensions'),
        notes: [...new Set(notes)],
      });
    }
  }

  return documents;
}

async function main() {
  const sourceRoot = resolve(process.argv[2] ?? '/private/tmp/paris-1970-source');
  const picturesRoot = join(sourceRoot, 'html', 'pictures', 'carres');
  const files = await findCandidateFiles(picturesRoot);
  const eadMetadata = await readEadMetadata(sourceRoot);
  const documents = {};

  for (const file of files) {
    const candidate = JSON.parse(await readFile(file, 'utf8'));
    const match = typeof candidate.full_url === 'string'
      ? ARK_PATTERN.exec(candidate.full_url)
      : null;
    if (!match) continue;

    const key = `${match[1].toUpperCase()}/${match[2].toUpperCase()}`;
    if (documents[key]) throw new Error(`Document dupliqué dans le catalogue : ${key}`);

    const author = typeof candidate.name === 'string' ? candidate.name.trim() : undefined;
    const locations = strings(candidate.locations);
    const candidateNumber = typeof candidate.number === 'string' && candidate.number.trim()
      ? candidate.number.trim()
      : undefined;
    const ead = eadMetadata.get(key);
    documents[key] = {
      ...(author ? { author } : {}),
      ...(locations.length ? { locations } : {}),
      ...(candidateNumber ? { candidateNumber } : {}),
      ...(ead?.callNumber ? { callNumber: ead.callNumber } : {}),
      ...(ead?.technique ? { technique: ead.technique } : {}),
      ...(ead?.extent ? { extent: ead.extent } : {}),
      ...(ead?.dimensions ? { dimensions: ead.dimensions } : {}),
      ...(ead?.notes?.length ? { notes: ead.notes } : {}),
    };
  }

  const orderedDocuments = Object.fromEntries(
    Object.entries(documents).sort(([left], [right]) => left.localeCompare(right)),
  );
  const catalog = {
    version: 1,
    source: PROJECT_URL,
    description: 'Métadonnées descriptives des notices BHVP, indexées par fonds/document ARK.',
    documents: orderedDocuments,
  };
  const target = join(root, 'assets', 'data', 'paris1970-metadata.json');
  await writeFile(target, `${JSON.stringify(catalog)}\n`, 'utf8');

  const named = Object.values(orderedDocuments).filter(
    ({ author }) => author && !/non identifi|inconnu/i.test(author),
  ).length;
  const located = Object.values(orderedDocuments).filter(({ locations }) => locations?.length).length;
  const bytes = Buffer.byteLength(JSON.stringify(catalog));
  process.stdout.write(
    `→ ${target}: ${Object.keys(orderedDocuments).length} dossiers, ${named} auteurs identifiés, ` +
      `${located} localisés (${(bytes / 1024).toFixed(0)} Ko)\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`\n${error.message}\n`);
  process.exit(1);
});
