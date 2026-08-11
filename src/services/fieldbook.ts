import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CAPTURES_KEY = 'reprise.fieldbook.captures.v1';
const ALBUM_NAME = 'Reprise';

type MediaLibraryModule = typeof import('expo-media-library');

/**
 * Chargement paresseux d'expo-media-library.
 *
 * Un `import` en tête de module fait tomber toute l'application quand le module natif est
 * absent : c'est le cas dans Expo Go et dans tout build compilé avant l'ajout de la dépendance.
 * Le carnet doit continuer de fonctionner dans ces environnements, quitte à ne pas pouvoir
 * écrire dans la photothèque.
 */
function loadMediaLibrary(): MediaLibraryModule | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library') as MediaLibraryModule;
  } catch {
    return undefined;
  }
}

export type SavedCapture = {
  id: string;
  stationId: string;
  /** URI affichable : celle de la photothèque si l'enregistrement a réussi, sinon le cache. */
  imageUri?: string;
  /** Identifiant de l'élément dans la photothèque, quand il a pu y être ajouté. */
  assetId?: string;
  simulated: boolean;
  /** Inclinaisons relevées au déclenchement, en degrés. Aucune comparaison d'image n'a lieu. */
  roll?: number;
  pitch?: number;
  /** Position relevée au déclenchement, uniquement si la permission était déjà accordée. */
  coordinate?: { latitude: number; longitude: number };
  locationPrecision?: 'precise' | 'approximate';
  createdAt: string;
};

export type CaptureSaveOutcome = {
  capture: SavedCapture;
  /** Faux si la photo n'a pas pu rejoindre la photothèque (permission refusée, simulateur…). */
  savedToLibrary: boolean;
};

export async function getSavedCaptures() {
  const value = await AsyncStorage.getItem(CAPTURES_KEY);
  return value ? (JSON.parse(value) as SavedCapture[]) : [];
}

/**
 * Copie la reprise dans la photothèque, album « Reprise ».
 *
 * L'URI rendue par la caméra pointe vers un cache temporaire qu'iOS purge : conservée telle
 * quelle, la photo du carnet finissait par ne plus s'afficher. C'est aussi ce dont l'utilisateur
 * a besoin pour la déposer ensuite sur le site de l'Observatoire, depuis son navigateur.
 */
async function copyToLibrary(uri: string) {
  const MediaLibrary = loadMediaLibrary();
  if (!MediaLibrary) return undefined;

  const permission = await MediaLibrary.requestPermissionsAsync(true, []);
  if (!permission.granted) return undefined;

  const asset = await MediaLibrary.createAssetAsync(uri);

  // Android autorise l'écriture de nos propres fichiers sans donner accès à toute la galerie.
  // Éviter la recherche d'album permet de ne demander aucune permission de lecture globale.
  if (Platform.OS === 'android') return { assetId: asset.id, uri: asset.uri };

  // L'album est un confort de rangement : son échec ne doit pas perdre la photo, déjà écrite.
  try {
    const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
    }
  } catch {
    // L'asset existe malgré tout dans la photothèque.
  }

  return { assetId: asset.id, uri: asset.uri };
}

export async function saveCapture(
  capture: Omit<SavedCapture, 'id' | 'createdAt' | 'assetId'>,
): Promise<CaptureSaveOutcome> {
  let assetId: string | undefined;
  let imageUri = capture.imageUri;

  if (capture.imageUri && !capture.simulated) {
    try {
      const stored = await copyToLibrary(capture.imageUri);
      if (stored) {
        assetId = stored.assetId;
        imageUri = stored.uri;
      }
    } catch {
      // On garde l'URI de cache : mieux vaut une photo fragile que pas de trace du tout.
    }
  }

  const current = await getSavedCaptures();
  const next: SavedCapture = {
    ...capture,
    imageUri,
    assetId,
    id: `${capture.stationId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(CAPTURES_KEY, JSON.stringify([next, ...current].slice(0, 50)));
  return { capture: next, savedToLibrary: Boolean(assetId) };
}
