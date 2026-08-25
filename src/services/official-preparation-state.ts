export type PreparedOfficialSource = {
  sourceUri: string;
};

export function canReusePreparedOfficialFile(
  prepared: PreparedOfficialSource | undefined,
  requestedUri: string | undefined,
) {
  return Boolean(prepared && requestedUri && prepared.sourceUri === requestedUri);
}

export type OfficialPreparationRequest = {
  generation: number;
  key: string;
};

export function isCurrentOfficialPreparation(
  request: OfficialPreparationRequest,
  latestRequest: OfficialPreparationRequest | undefined,
) {
  return request.generation === latestRequest?.generation && request.key === latestRequest.key;
}

export function isCurrentOfficialFileMessage(
  message: { documentId: string; preparationId: string },
  latestRequest: OfficialPreparationRequest | undefined,
  documentGeneration: number,
) {
  return (
    message.preparationId === String(latestRequest?.generation ?? '') &&
    message.documentId === String(documentGeneration)
  );
}

const REFERENCE_IMAGE_ORIGINS = new Set([
  'https://bibliotheques-specialisees.paris.fr',
  'https://i0.wp.com',
]);

export function isAllowedOfficialReferenceUri(value: string) {
  try {
    const url = new URL(value);
    if (!REFERENCE_IMAGE_ORIGINS.has(url.origin) || url.username || url.password || url.port) {
      return false;
    }
    if (!/\.(?:jpe?g|png)$/i.test(url.pathname)) return false;
    if (url.origin === 'https://i0.wp.com') {
      return /^\/(?:observatoire-photo\.paris|opppp\.cartes\.xyz)\/uploads\/opppp\/images\//i.test(
        url.pathname,
      );
    }
    return true;
  } catch {
    return false;
  }
}
