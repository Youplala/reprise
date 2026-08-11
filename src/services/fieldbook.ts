import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import {
  createFieldbookStore,
  type CapturePreparation,
  type NewCapture,
  type SavedCapture,
} from '@/services/fieldbook-store';

export type { CapturePreparation, NewCapture, SavedCapture } from '@/services/fieldbook-store';

const ALBUM_NAME = 'Reprise';
const CAPTURES_DIRECTORY = new Directory(Paths.document, 'reprise-captures');

type MediaLibraryModule = typeof import('expo-media-library');

function loadMediaLibrary(): MediaLibraryModule | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library') as MediaLibraryModule;
  } catch {
    return undefined;
  }
}

function captureExtension(uri: string) {
  const extension = uri.match(/\.(jpe?g|png|heic|heif)(?:[?#]|$)/i)?.[1]?.toLowerCase();
  return extension ? `.${extension === 'jpeg' ? 'jpg' : extension}` : '.jpg';
}

const files = {
  async copyToDocuments(sourceUri: string, captureId: string) {
    CAPTURES_DIRECTORY.create({ idempotent: true, intermediates: true });
    const source = new File(sourceUri);
    const destination = new File(
      CAPTURES_DIRECTORY,
      `${captureId}${captureExtension(sourceUri)}`,
    );
    await source.copy(destination);
    return destination.uri;
  },
  async exists(uri: string) {
    return new File(uri).exists;
  },
  isManaged(uri: string) {
    return uri.startsWith(`${CAPTURES_DIRECTORY.uri}/`);
  },
  async remove(uri: string) {
    new File(uri).delete();
  },
};

const store = createFieldbookStore({ storage: AsyncStorage, files });

async function copyToLibrary(uri: string) {
  const MediaLibrary = loadMediaLibrary();
  if (!MediaLibrary) return undefined;

  const permission = await MediaLibrary.requestPermissionsAsync(true, []);
  if (!permission.granted) return undefined;

  const asset = await MediaLibrary.createAssetAsync(uri);
  if (Platform.OS !== 'android') {
    try {
      const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
      }
    } catch {
      // L'asset existe déjà : l'album n'est qu'un confort de rangement.
    }
  }
  return asset.id;
}

export type CaptureSaveOutcome = {
  capture: SavedCapture;
  savedToLibrary: boolean;
};

export async function getSavedCaptures() {
  return store.list();
}

/**
 * Écrit d'abord une copie privée durable dans Documents. Photos reste une copie facultative :
 * un refus de permission ne peut donc plus fragiliser le brouillon.
 */
export async function saveCapture(capture: NewCapture): Promise<CaptureSaveOutcome> {
  let saved = await store.save(capture);
  let assetId: string | undefined;

  if (saved.imageUri && !saved.simulated) {
    try {
      assetId = await copyToLibrary(saved.imageUri);
    } catch {
      // Le brouillon Documents est déjà durable et reste la source de vérité.
    }
  }

  if (assetId) {
    saved =
      (await store.update(saved.id, {
        assetId,
        preparation: { ...saved.preparation, current: true },
      })) ?? saved;
  }
  return { capture: saved, savedToLibrary: Boolean(assetId) };
}

export async function updateCapturePreparation(id: string, preparation: CapturePreparation) {
  return store.update(id, { preparation });
}

export async function deleteCapture(id: string) {
  return store.remove(id);
}
