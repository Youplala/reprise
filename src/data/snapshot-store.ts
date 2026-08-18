import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { BUNDLED_SNAPSHOT, isUsableSnapshot, type Snapshot } from '@/data/snapshot';

const CACHE_KEY = 'reprise.snapshot.v1';
const FETCH_TIMEOUT_MS = 12_000;

/**
 * Adresse du relevé publié. Une action planifiée régénère ce fichier chaque nuit et le commite,
 * ce qui évite de soumettre une nouvelle version de l'app à chaque changement de chiffres.
 *
 * Configurable depuis `app.json` (`extra.snapshotUrl`) pour pouvoir changer d'hébergement sans
 * toucher au code. Vide, la mise à jour distante est simplement désactivée.
 */
const REMOTE_URL: string | undefined = Constants.expoConfig?.extra?.snapshotUrl;

/** Compare deux relevés par leur date de génération, du plus récent au plus ancien. */
function isNewer(candidate: Snapshot, current: Snapshot) {
  return candidate.generatedAt > current.generatedAt;
}

/**
 * Relevé à utiliser au démarrage : la copie mise en cache si elle est plus récente que celle
 * embarquée, sinon celle du bundle. Toute anomalie de lecture retombe sur le bundle, qui est
 * toujours valide par construction.
 */
export async function loadStoredSnapshot(): Promise<Snapshot> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return BUNDLED_SNAPSHOT;

    const parsed: unknown = JSON.parse(cached);
    if (!isUsableSnapshot(parsed)) return BUNDLED_SNAPSHOT;

    // Après une mise à jour de l'app, le bundle peut être plus récent que le cache.
    return isNewer(parsed, BUNDLED_SNAPSHOT) ? parsed : BUNDLED_SNAPSHOT;
  } catch {
    return BUNDLED_SNAPSHOT;
  }
}

/**
 * Télécharge le relevé publié et le met en cache s'il est plus récent que `current`.
 *
 * Renvoie le relevé à adopter, ou `undefined` s'il n'y a rien de neuf. Les anomalies réseau ou de
 * format sont remontées au provider, qui conserve le relevé courant et affiche l'état hors ligne.
 */
export async function refreshSnapshot(current: Snapshot): Promise<Snapshot | undefined> {
  if (!REMOTE_URL) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(REMOTE_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Mise à jour des données : HTTP ${response.status}`);

    const parsed: unknown = await response.json();
    if (!isUsableSnapshot(parsed)) throw new Error('Mise à jour des données : format invalide');
    if (!isNewer(parsed, current)) return undefined;

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
