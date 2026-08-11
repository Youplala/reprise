import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

export {
  buildObservatoirePrefillScript,
  parseOfficialBridgeMessage,
  type OfficialBridgeMessage,
  type OfficialPrefill,
} from './official-prefill';

export const OBSERVATOIRE_CONTRIBUTION_URL =
  'https://observatoire-photo.paris/elements/add';
export const OBSERVATOIRE_HOST = 'observatoire-photo.paris';
export const OFFICIAL_SUBMISSION_FIXTURE_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_OFFICIAL_SUBMISSION_FIXTURE === '1';

export type PreparedImages = {
  current: boolean;
  reference: boolean;
};

async function addToRepriseAlbum(uri: string, filename: string) {
  let localUri = uri;
  if (/^https?:\/\//i.test(uri)) {
    const target = new File(Paths.cache, filename);
    const downloaded = await File.downloadFileAsync(uri, target, { idempotent: true });
    localUri = downloaded.uri;
  }

  const asset = await MediaLibrary.createAssetAsync(localUri);
  if (Platform.OS === 'ios') {
    try {
      const album = await MediaLibrary.getAlbumAsync('Reprise');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('Reprise', asset, false);
      }
    } catch {
      // La photo est déjà enregistrée ; l'album dédié reste un simple confort de rangement.
    }
  }
}

/**
 * Place les deux fichiers dans l'album Reprise, avant d'ouvrir les sélecteurs du formulaire.
 * Ils ne quittent pas le téléphone et ne sont jamais envoyés par ce service.
 */
export async function prepareImagesForOfficialForm(input: {
  currentAlreadySaved?: boolean;
  currentUri?: string;
  referenceUri?: string;
  stationId: string;
}): Promise<PreparedImages> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, []);
  if (!permission.granted) throw new Error('PHOTO_LIBRARY_DENIED');

  const safeId = input.stationId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const result = {
    current: Boolean(input.currentAlreadySaved),
    reference: false,
  };

  if (input.referenceUri) {
    await addToRepriseAlbum(input.referenceUri, `reprise-${safeId}-reference.jpg`);
    result.reference = true;
  }
  if (input.currentUri && !input.currentAlreadySaved) {
    await addToRepriseAlbum(
      input.currentUri,
      `reprise-${safeId}-${new Date().getFullYear()}.jpg`,
    );
    result.current = true;
  }

  return result;
}
