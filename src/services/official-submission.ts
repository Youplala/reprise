import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import {
  assertOfficialImageContent,
  assertOfficialImageSize,
  imageFilenameForUri,
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
export const OFFICIAL_SUBMISSION_FIXTURE_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_OFFICIAL_SUBMISSION_FIXTURE === '1';


async function addToPhotos(uri: string, filenameStem: string) {
  let localUri = uri;
  let localFile: File;
  if (/^https?:\/\//i.test(uri)) {
    const target = new File(Paths.cache, imageFilenameForUri(filenameStem, uri));
    try {
      localFile = await File.downloadFileAsync(uri, target, { idempotent: true });
      localUri = localFile.uri;
    } catch {
      throw new OfficialImagePreparationError('download-failed');
    }
  } else {
    imageFilenameForUri(filenameStem, uri);
    localFile = new File(uri);
  }
  assertOfficialImageSize(localFile.size);
  assertOfficialImageContent(await localFile.bytes(), uri);

  await MediaLibrary.createAssetAsync(localUri).catch(() => {
    throw new OfficialImagePreparationError('save-failed');
  });
}

/**
 * Copie les deux fichiers dans Photos (Récents), avant d'ouvrir les sélecteurs du formulaire.
 * L'autorisation add-only suffit : aucune lecture de la photothèque ni gestion d'album.
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
  let currentAlreadySaved = input.currentAlreadySaved;
  let previous = input.previous;
  if (currentAlreadySaved) {
    try {
      if (!input.currentUri) throw new OfficialImagePreparationError('missing-uri');
      const currentFile = new File(input.currentUri);
      assertOfficialImageSize(currentFile.size);
      assertOfficialImageContent(await currentFile.bytes(), input.currentUri);
    } catch {
      currentAlreadySaved = false;
      previous = {
        current: { ready: false },
        reference: input.previous?.reference ?? { ready: false },
      };
    }
  }
  return prepareImagePair({
    currentAlreadySaved,
    currentUri: input.currentUri,
    previous,
    referenceUri: input.referenceUri,
    requestPermission: async () => {
      const permission = await MediaLibrary.requestPermissionsAsync(true, []);
      return permission.granted;
    },
    save: (kind, imageUri) =>
      addToPhotos(
        imageUri,
        kind === 'reference'
          ? `reprise-${safeId}-reference`
          : `reprise-${safeId}-${new Date().getFullYear()}`,
      ),
  });
}
