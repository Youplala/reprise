import type { ImageSource } from 'expo-image';

const BHVP_ORIGIN = 'https://bibliotheques-specialisees.paris.fr';

type PictureRecord = {
  hiResimage?: string;
  image?: string;
  thumb?: string;
};

const requestCache = new Map<string, Promise<ImageSource[]>>();

/**
 * Les images restent servies par la visionneuse de la BHVP : Paris GO ne duplique pas le fonds.
 * L'affichage peut être coupé à distance dans un build si la source change temporairement.
 */
export const BHVP_PREVIEWS_ENABLED =
  process.env.EXPO_PUBLIC_BHVP_PREVIEWS !== '0';

function requestForArchiveLink(link: string) {
  let source: URL;
  try {
    source = new URL(link);
  } catch {
    return undefined;
  }
  const cleanPath = source.pathname.replace(/\.simple\.selectedTab=record.*$/, '');
  const parts = cleanPath.split('/').filter(Boolean);

  if (parts.length < 2) return undefined;

  const documentId = parts.slice(0, -1).join('/');
  const ark = `/${parts.join('/')}.simple.selectedTab=record`;
  const endpoint = new URL('/in/imageReader.xhtml', BHVP_ORIGIN);
  endpoint.searchParams.set('id', documentId);
  endpoint.searchParams.set('ark', ark);
  endpoint.searchParams.set('selectedTab', 'record');

  return { documentId, endpoint: endpoint.toString() };
}

function absoluteImageUrl(path?: string) {
  if (!path) return undefined;
  return new URL(path, BHVP_ORIGIN).toString();
}

async function picturesForRequest(
  key: string,
  endpoint: string,
): Promise<ImageSource[]> {
  const cached = requestCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const request = fetch(endpoint, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`BHVP ${response.status}`);
      const html = await response.text();
      const match = html.match(/var pictureList = (\[[\s\S]*?\]);/);
      if (!match) return [];

      const records = JSON.parse(match[1]) as PictureRecord[];
      return records
        // L'aperçu intermédiaire suffit à l'alignement et s'affiche beaucoup plus vite que
        // l'original haute définition sur le terrain.
        .map((record) => absoluteImageUrl(record.image ?? record.hiResimage ?? record.thumb))
        .filter((uri): uri is string => Boolean(uri))
        .map((uri) => ({ uri }));
    })
    .catch(() => {
      // Une coupure réseau ne doit pas empoisonner le cache jusqu'au prochain redémarrage.
      requestCache.delete(key);
      return [];
    })
    .finally(() => clearTimeout(timeout));

  requestCache.set(key, request);
  return request;
}

/** Résout les miniatures des différents dossiers d'un secteur, sans requête en doublon. */
export async function loadBhvpImages(
  archiveLinks: readonly string[],
  limit = Number.POSITIVE_INFINITY,
): Promise<ImageSource[]> {
  if (!BHVP_PREVIEWS_ENABLED || archiveLinks.length === 0) return [];

  const requests = new Map<string, string>();
  for (const link of archiveLinks) {
    const request = requestForArchiveLink(link);
    if (request && !requests.has(request.documentId)) {
      requests.set(request.documentId, request.endpoint);
    }
  }

  const seen = new Set<string>();
  const images: ImageSource[] = [];
  const entries = [...requests];
  const groups = Number.isFinite(limit)
    ? undefined
    : await Promise.all(entries.map(([key, endpoint]) => picturesForRequest(key, endpoint)));

  for (let index = 0; index < entries.length; index += 1) {
    // Pour une carte, on s'arrête dès que la planche-contact est pleine. La fiche détaillée,
    // elle, résout tous les dossiers en parallèle.
    const group =
      groups?.[index] ?? (await picturesForRequest(entries[index][0], entries[index][1]));
    for (const image of group) {
      const uri = typeof image === 'object' && image ? image.uri : undefined;
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      images.push(image);
      if (images.length >= limit) return images;
    }
  }

  return images;
}
