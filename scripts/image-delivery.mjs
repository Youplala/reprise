const IMAGE_ORIGINS = new Set([
  'opppp.cartes.xyz',
  'observatoire-photo.paris',
]);
const IMAGE_PATH_PREFIX = '/uploads/opppp/images/elements/';
const DELIVERY_ORIGIN = 'https://i0.wp.com';

/**
 * Publie uniquement les images de l’Observatoire via le CDN validé sur iPhone.
 * Les domaines et le chemin sont explicitement bornés pour ne jamais créer un proxy ouvert.
 */
export function deliveryImageUrl(value) {
  if (typeof value !== 'string') return undefined;
  const authority = value.match(/^https:\/\/([^/?#]+)/)?.[1];

  let upstream;
  try {
    upstream = new URL(value);
  } catch {
    return undefined;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(upstream.pathname);
  } catch {
    return undefined;
  }
  const filename = decodedPath.slice(IMAGE_PATH_PREFIX.length);

  if (
    upstream.protocol !== 'https:' ||
    authority !== upstream.hostname ||
    upstream.username ||
    upstream.password ||
    upstream.port ||
    value.includes('?') ||
    value.includes('#') ||
    upstream.search ||
    upstream.hash ||
    !IMAGE_ORIGINS.has(upstream.hostname) ||
    !decodedPath.startsWith(IMAGE_PATH_PREFIX) ||
    !filename ||
    filename.includes('%') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    !/\.(?:jpe?g|png)$/i.test(filename)
  ) {
    return undefined;
  }

  return `${DELIVERY_ORIGIN}/${upstream.hostname}${IMAGE_PATH_PREFIX}${encodeURIComponent(filename)}?ssl=1`;
}

export function deliveryImageUrls(values) {
  const list = Array.isArray(values) ? values : [];
  return [...new Set(list.map(deliveryImageUrl).filter(Boolean))];
}
