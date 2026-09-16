import type { ImageSource } from 'expo-image';

const BHVP_ORIGIN = 'https://bibliotheques-specialisees.paris.fr';

type PictureRecord = {
  hiResimage?: string;
  image?: string;
  thumb?: string;
};

const requestCache = new Map<string, Promise<(ImageSource | undefined)[]>>();

export type ArchiveImageSource = ImageSource & { archiveLink: string };

export function archiveLinkForImage(image?: ImageSource): string | undefined {
  return image && typeof image === 'object' && 'archiveLink' in image && typeof image.archiveLink === 'string'
    ? image.archiveLink : undefined;
}

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

  const view = parts.at(-1)?.match(/^v(\d+)$/);
  if (parts.length < 2 || !view || Number(view[1]) < 1) return undefined;

  const documentId = parts.slice(0, -1).join('/');
  const ark = `/${parts.join('/')}.simple.selectedTab=record`;
  const endpoint = new URL('/in/imageReader.xhtml', BHVP_ORIGIN);
  endpoint.searchParams.set('id', documentId);
  endpoint.searchParams.set('ark', ark);
  endpoint.searchParams.set('selectedTab', 'record');

  return { documentId, endpoint: endpoint.toString(), viewIndex: Number(view[1]) - 1 };
}

function absoluteImageUrl(path?: string) {
  if (!path) return undefined;
  return new URL(path, BHVP_ORIGIN).toString();
}

async function picturesForRequest(
  key: string,
  endpoint: string,
): Promise<(ImageSource | undefined)[]> {
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
        // Ne pas filtrer les trous : v0003 doit rester la troisième vue du dossier.
        .map((uri) => uri ? { uri } : undefined);
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
): Promise<ArchiveImageSource[]> {
  if (!BHVP_PREVIEWS_ENABLED || archiveLinks.length === 0 || limit <= 0) return [];

  const requests = new Map<string, string>();
  for (const link of archiveLinks) {
    const request = requestForArchiveLink(link);
    if (request && !requests.has(request.documentId)) {
      requests.set(request.documentId, request.endpoint);
    }
  }

  // Une erreur est mémorisée pour cet appel, mais pas pour le prochain essai utilisateur.
  const groups = new Map<string, Promise<(ImageSource | undefined)[]>>();
  const groupFor = (key: string, endpoint: string) => {
    let group = groups.get(key);
    if (!group) {
      group = picturesForRequest(key, endpoint);
      groups.set(key, group);
    }
    return group;
  };
  if (!Number.isFinite(limit)) await Promise.all([...requests].map(([key, endpoint]) => groupFor(key, endpoint)));
  const seen = new Set<string>();
  const images: ArchiveImageSource[] = [];
  for (const archiveLink of archiveLinks) {
    if (seen.has(archiveLink)) continue;
    seen.add(archiveLink);
    const request = requestForArchiveLink(archiveLink);
    if (!request) continue;
    const group = await groupFor(request.documentId, request.endpoint);
    const image = group[request.viewIndex];
    if (!image) continue;
    images.push({ ...image, archiveLink });
    if (images.length >= limit) break;
  }

  return images;
}
