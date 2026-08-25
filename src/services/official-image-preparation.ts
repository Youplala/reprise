export type ImagePreparationError =
  | 'download-failed'
  | 'file-too-large'
  | 'invalid-image-content'
  | 'missing-uri'
  | 'permission-denied'
  | 'save-failed'
  | 'size-check-failed'
  | 'unsupported-format'
  | 'untrusted-uri';

export type PreparedImageState = {
  error?: ImagePreparationError;
  ready: boolean;
};

export type PreparedImages = {
  current: PreparedImageState;
  reference: PreparedImageState;
};

export function emptyPreparedImages(): PreparedImages {
  return {
    current: { ready: false },
    reference: { ready: false },
  };
}

export const EMPTY_PREPARED_IMAGES: PreparedImages = emptyPreparedImages();

export class OfficialImagePreparationError extends Error {
  readonly code: ImagePreparationError;

  constructor(code: ImagePreparationError) {
    super(code);
    this.code = code;
    this.name = 'OfficialImagePreparationError';
  }
}

type ImageKind = keyof PreparedImages;

export const OFFICIAL_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

type SynchronousFlight = { current: boolean };

export function tryStartImagePreparation(inFlight: SynchronousFlight) {
  if (inFlight.current) return false;
  inFlight.current = true;
  return true;
}

export function didAddReadyImage(previous: PreparedImages, next: PreparedImages) {
  return (['current', 'reference'] as const).some(
    (kind) => !previous[kind].ready && next[kind].ready,
  );
}

function imageExtension(uri: string) {
  let pathname: string;
  try {
    pathname = new URL(uri).pathname;
  } catch {
    pathname = uri.split(/[?#]/, 1)[0];
  }
  const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension && ['jpeg', 'jpg', 'png'].includes(extension)
    ? extension
    : undefined;
}

export function imageFilenameForUri(stem: string, uri: string) {
  const extension = imageExtension(uri);
  if (!extension) throw new OfficialImagePreparationError('unsupported-format');
  return `${stem}.${extension}`;
}

export function assertOfficialImageSize(size: number | null) {
  if (size === null) {
    throw new OfficialImagePreparationError('size-check-failed');
  }
  if (size > OFFICIAL_IMAGE_MAX_BYTES) {
    throw new OfficialImagePreparationError('file-too-large');
  }
}

export function assertOfficialImageContent(bytes: Uint8Array, uri: string) {
  const extension = imageExtension(uri);
  if (!extension) throw new OfficialImagePreparationError('unsupported-format');
  const isJpeg =
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng =
    bytes.length >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value);
  const matchesExtension = extension === 'png' ? isPng : isJpeg;
  if (!matchesExtension) throw new OfficialImagePreparationError('invalid-image-content');
}

type PrepareImagePairInput = {
  currentAlreadySaved?: boolean;
  currentUri?: string;
  previous?: PreparedImages;
  referenceUri?: string;
  requestPermission: () => Promise<boolean>;
  save: (kind: ImageKind, uri: string) => Promise<void>;
};

function initialState(input: PrepareImagePairInput): PreparedImages {
  return {
    current: input.currentAlreadySaved || input.previous?.current.ready
      ? { ready: true }
      : { ...input.previous?.current, ready: false },
    reference: input.previous?.reference.ready
      ? { ready: true }
      : { ...input.previous?.reference, ready: false },
  };
}

/**
 * Orchestre les deux préparations sans jamais laisser l'échec d'un fichier effacer le succès
 * de l'autre. Les états déjà prêts sont ignorés afin qu'un retry reste idempotent.
 */
export async function prepareImagePair(input: PrepareImagePairInput): Promise<PreparedImages> {
  const result = initialState(input);
  const pending = (['current', 'reference'] as const).filter((kind) => !result[kind].ready);
  if (pending.length === 0) return result;

  let granted = false;
  try {
    granted = await input.requestPermission();
  } catch {
    // Une erreur native de permission est présentée comme un refus, avec accès aux Réglages.
  }
  if (!granted) {
    for (const kind of pending) result[kind] = { ready: false, error: 'permission-denied' };
    return result;
  }

  for (const kind of pending) {
    const uri = kind === 'current' ? input.currentUri : input.referenceUri;
    if (!uri) {
      result[kind] = { ready: false, error: 'missing-uri' };
      continue;
    }

    try {
      await input.save(kind, uri);
      result[kind] = { ready: true };
    } catch (error) {
      result[kind] = {
        ready: false,
        error:
          error instanceof OfficialImagePreparationError ? error.code : 'save-failed',
      };
    }
  }

  return result;
}
