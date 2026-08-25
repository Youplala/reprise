const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const EMAIL_PATTERN_GLOBAL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PRIVATE_KEY_PATTERN = /email|mail|contact/i;

/** Conserve le texte public, mais ne republie jamais une adresse de contact. */
export function sanitizePublicText(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (new RegExp(`^${EMAIL_PATTERN.source}$`).test(trimmed)) return undefined;
  return trimmed.replace(EMAIL_PATTERN_GLOBAL, '[coordonnée retirée]');
}

function containsPrivateKey(value) {
  if (Array.isArray(value)) return value.some(containsPrivateKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, child]) => PRIVATE_KEY_PATTERN.test(key) || containsPrivateKey(child),
  );
}

/** Refuse tout champ ou valeur de contact sans recopier la donnée sensible dans les logs CI. */
export function assertNoPersonalData(payload) {
  const serialized = JSON.stringify(payload);
  if (EMAIL_PATTERN.test(serialized) || containsPrivateKey(payload)) {
    throw new Error(
      'Fuite de données personnelles détectée dans le snapshot. ' +
        'Écriture annulée — corriger la liste blanche de champs avant de relancer.',
    );
  }
}
