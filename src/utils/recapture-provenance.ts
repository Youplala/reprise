// Provenance déclarative, pas une certification : le commentaire public reste éditable.
const PARIS_GO_MENTION = /(?:^|[^\p{L}\p{N}])paris\s+go(?=$|[^\p{L}\p{N}])/iu;

// Deux reprises antérieures à la signature automatique, confirmées par leur auteur
// le 14 septembre 2026. Migration limitée aux fiches, jamais au nom du contributeur.
const CONFIRMED_LEGACY_RECAPTURES = new Set(['1h3', '1mv']);

export function isParisGoRecapture(photo: {
  id: string;
  hasRecapture: boolean;
  description?: string;
}): boolean {
  return photo.hasRecapture && (
    CONFIRMED_LEGACY_RECAPTURES.has(photo.id) || PARIS_GO_MENTION.test(photo.description ?? '')
  );
}
