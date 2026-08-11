export type ImagePreparationError =
  | 'download-failed'
  | 'missing-uri'
  | 'permission-denied'
  | 'save-failed'
  | 'unsupported-format';

export type PreparedImageState = {
  error?: ImagePreparationError;
  ready: boolean;
};

export type PreparedImages = {
  current: PreparedImageState;
  reference: PreparedImageState;
};

export const EMPTY_PREPARED_IMAGES: PreparedImages = {
  current: { ready: false },
  reference: { ready: false },
};

export class OfficialImagePreparationError extends Error {
  readonly code: ImagePreparationError;

  constructor(code: ImagePreparationError) {
    super(code);
    this.code = code;
    this.name = 'OfficialImagePreparationError';
  }
}

type ImageKind = keyof PreparedImages;

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
