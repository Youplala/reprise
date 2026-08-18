const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PRIVATE_KEY_PATTERN = /email|mail|contact/i;

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
