import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

import {
  OfficialImagePreparationError,
  prepareImagePair,
  type PreparedImages,
} from '@/services/official-image-preparation';

export type { PreparedImages } from '@/services/official-image-preparation';
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


async function addToRepriseAlbum(uri: string, filename: string) {
  const extension = (() => {
    try {
      return new URL(uri).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    } catch {
      return uri.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    }
  })();
  if (extension && !['heic', 'heif', 'jpeg', 'jpg', 'png'].includes(extension)) {
    throw new OfficialImagePreparationError('unsupported-format');
  }

  let localUri = uri;
  if (/^https?:\/\//i.test(uri)) {
    const target = new File(Paths.cache, filename);
    try {
      const downloaded = await File.downloadFileAsync(uri, target, { idempotent: true });
      localUri = downloaded.uri;
    } catch {
      throw new OfficialImagePreparationError('download-failed');
    }
  }

  const asset = await MediaLibrary.createAssetAsync(localUri).catch(() => {
    throw new OfficialImagePreparationError('save-failed');
  });
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
  previous?: PreparedImages;
  referenceUri?: string;
  stationId: string;
}): Promise<PreparedImages> {
  const safeId = input.stationId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return prepareImagePair({
    currentAlreadySaved: input.currentAlreadySaved,
    currentUri: input.currentUri,
    previous: input.previous,
    referenceUri: input.referenceUri,
    requestPermission: async () => {
      const permission = await MediaLibrary.requestPermissionsAsync(true, []);
      return permission.granted;
    },
    save: (kind, imageUri) =>
      addToRepriseAlbum(
        imageUri,
        kind === 'reference'
          ? `reprise-${safeId}-reference.jpg`
          : `reprise-${safeId}-${new Date().getFullYear()}.jpg`,
      ),
  });
}
