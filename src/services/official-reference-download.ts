import {
  assertOfficialImageContent,
  assertOfficialImageSize,
  officialBytesToBase64,
  OfficialImagePreparationError,
} from '@/services/official-image-preparation';
import type { OfficialUploadFile } from '@/services/official-file-injection';
import { isAllowedOfficialReferenceUri } from '@/services/official-preparation-state';

function mimeTypeForFilename(filename: string): OfficialUploadFile['mimeType'] {
  return /\.png$/i.test(filename) ? 'image/png' : 'image/jpeg';
}

export async function fetchOfficialReferenceUpload(
  uri: string,
  filename: string,
): Promise<OfficialUploadFile> {
  let response: Response;
  try {
    response = await fetch(uri);
  } catch {
    throw new OfficialImagePreparationError('download-failed');
  }
  if (!response.ok) throw new OfficialImagePreparationError('download-failed');
  if (!isAllowedOfficialReferenceUri(response.url)) {
    throw new OfficialImagePreparationError('untrusted-uri');
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new OfficialImagePreparationError('download-failed');
  }
  assertOfficialImageSize(bytes.byteLength);
  assertOfficialImageContent(bytes, uri);
  return {
    base64: officialBytesToBase64(bytes),
    filename,
    mimeType: mimeTypeForFilename(filename),
    size: bytes.byteLength,
  };
}
