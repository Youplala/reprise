import { File, Paths } from 'expo-file-system';

import {
  assertOfficialImageContent,
  assertOfficialImageSize,
  imageFilenameForUri,
  OfficialImagePreparationError,
  type PreparedImages,
} from '@/services/official-image-preparation';
import type {
  OfficialUploadFile,
  OfficialUploadFiles,
} from '@/services/official-file-injection';
import {
  canReusePreparedOfficialFile,
  isAllowedOfficialReferenceUri,
  nextOfficialTemporaryFilename,
} from '@/services/official-preparation-state';

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

export type OfficialFormImagePreparation = {
  files: Partial<OfficialUploadFiles>;
  images: PreparedImages;
  preparationId?: string;
  sources: Partial<Record<'current' | 'reference', { sourceUri: string }>>;
};

function mimeTypeForFilename(filename: string): OfficialUploadFile['mimeType'] {
  return /\.png$/i.test(filename) ? 'image/png' : 'image/jpeg';
}

async function prepareUploadFile(uri: string, filenameStem: string): Promise<OfficialUploadFile> {
  const filename = imageFilenameForUri(filenameStem, uri);
  let localFile = new File(uri);
  let downloaded = false;
  if (/^https?:\/\//i.test(uri)) {
    const target = new File(Paths.cache, nextOfficialTemporaryFilename(filename));
    try {
      localFile = await File.downloadFileAsync(uri, target, { idempotent: true });
      downloaded = true;
    } catch {
      throw new OfficialImagePreparationError('download-failed');
    }
  }

  try {
    assertOfficialImageSize(localFile.size);
    assertOfficialImageContent(await localFile.bytes(), uri);
    return {
      base64: await localFile.base64(),
      filename,
      mimeType: mimeTypeForFilename(filename),
      size: localFile.size ?? 0,
    };
  } finally {
    // La copie distante n'est utile que le temps de créer le File WebView. Le cache ne doit pas
    // devenir une seconde photothèque durable.
    if (downloaded) {
      try {
        localFile.delete();
      } catch {
        // Le cache système reste éphémère si sa suppression immédiate échoue.
      }
    }
  }
}

/**
 * Prépare les deux fichiers directement pour le multipart GoGoCarto. Aucune autorisation Photos
 * n'est nécessaire et aucun fichier personnel n'est envoyé à Reprise : les octets restent en
 * mémoire jusqu'à leur injection sur l'origine officielle exacte.
 */
export async function prepareImagesForOfficialForm(input: {
  currentAuthorized: boolean;
  currentUri?: string;
  preparationId: string;
  previous?: OfficialFormImagePreparation;
  referenceUri?: string;
  stationId: string;
}): Promise<OfficialFormImagePreparation> {
  const safeId = input.stationId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const files: Partial<OfficialUploadFiles> = {};
  const sources: OfficialFormImagePreparation['sources'] = {};
  for (const kind of ['reference', 'current'] as const) {
    const uri = kind === 'reference' ? input.referenceUri : input.currentUri;
    const trusted =
      kind === 'current' ? input.currentAuthorized : Boolean(uri && isAllowedOfficialReferenceUri(uri));
    if (trusted && canReusePreparedOfficialFile(input.previous?.sources[kind], uri)) {
      files[kind] = input.previous?.files[kind];
      sources[kind] = input.previous?.sources[kind];
    }
  }
  const images: PreparedImages = {
    current: files.current ? { ready: true } : { ready: false },
    reference: files.reference ? { ready: true } : { ready: false },
  };

  for (const kind of ['reference', 'current'] as const) {
    if (files[kind]) continue;
    const uri = kind === 'reference' ? input.referenceUri : input.currentUri;
    if (!uri) {
      images[kind] = { ready: false, error: 'missing-uri' };
      continue;
    }
    if (
      (kind === 'current' && !input.currentAuthorized) ||
      (kind === 'reference' && !isAllowedOfficialReferenceUri(uri))
    ) {
      images[kind] = { ready: false, error: 'untrusted-uri' };
      continue;
    }
    try {
      files[kind] = await prepareUploadFile(
        uri,
        kind === 'reference'
          ? `reprise-${safeId}-reference`
          : `reprise-${safeId}-${new Date().getFullYear()}`,
      );
      sources[kind] = { sourceUri: uri };
      images[kind] = { ready: true };
    } catch (error) {
      images[kind] = {
        ready: false,
        error:
          error instanceof OfficialImagePreparationError ? error.code : 'save-failed',
      };
    }
  }

  return { files, images, preparationId: input.preparationId, sources };
}
