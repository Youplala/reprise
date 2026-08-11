export const FIELD_BOOK_KEY = 'reprise.fieldbook.captures.v1';
export const FIELD_BOOK_LIMIT = 50;

export type CapturePreparation = {
  current: boolean;
  reference: boolean;
};

export type SavedCapture = {
  schemaVersion: 2;
  id: string;
  stationId: string;
  stationName?: string;
  stationAddress?: string;
  frameIndex: number;
  /** Copie privée dans le dossier Documents de Reprise, jamais une URI de cache. */
  imageUri?: string;
  /** Identifiant de la copie facultative dans Photos. */
  assetId?: string;
  simulated: boolean;
  roll?: number;
  pitch?: number;
  coordinate?: { latitude: number; longitude: number };
  preparation: CapturePreparation;
  createdAt: string;
};

export type NewCapture = Omit<
  SavedCapture,
  'schemaVersion' | 'id' | 'createdAt' | 'assetId' | 'preparation'
> & {
  preparation?: CapturePreparation;
};

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type FilesAdapter = {
  copyToDocuments: (sourceUri: string, captureId: string) => Promise<string>;
  exists: (uri: string) => Promise<boolean>;
  isManaged: (uri: string) => boolean;
  remove: (uri: string) => Promise<void>;
};

type StoreDependencies = {
  storage: StorageAdapter;
  files: FilesAdapter;
  now?: () => Date;
};

type LegacyCapture = Partial<SavedCapture> & {
  frame?: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalize(raw: unknown): SavedCapture | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const capture = raw as LegacyCapture;
  if (typeof capture.id !== 'string' || typeof capture.stationId !== 'string') return undefined;
  if (typeof capture.createdAt !== 'string' || Number.isNaN(Date.parse(capture.createdAt))) {
    return undefined;
  }

  const preparation = capture.preparation;
  return {
    schemaVersion: 2,
    id: capture.id,
    stationId: capture.stationId,
    stationName: typeof capture.stationName === 'string' ? capture.stationName : undefined,
    stationAddress: typeof capture.stationAddress === 'string' ? capture.stationAddress : undefined,
    frameIndex: isFiniteNumber(capture.frameIndex)
      ? Math.max(0, Math.trunc(capture.frameIndex))
      : isFiniteNumber(capture.frame)
        ? Math.max(0, Math.trunc(capture.frame))
        : 0,
    imageUri: typeof capture.imageUri === 'string' && capture.imageUri ? capture.imageUri : undefined,
    assetId: typeof capture.assetId === 'string' ? capture.assetId : undefined,
    simulated: capture.simulated === true,
    roll: isFiniteNumber(capture.roll) ? capture.roll : undefined,
    pitch: isFiniteNumber(capture.pitch) ? capture.pitch : undefined,
    coordinate:
      isFiniteNumber(capture.coordinate?.latitude) && isFiniteNumber(capture.coordinate?.longitude)
        ? {
            latitude: capture.coordinate.latitude,
            longitude: capture.coordinate.longitude,
          }
        : undefined,
    preparation: {
      current: preparation?.current === true || Boolean(capture.assetId),
      reference: preparation?.reference === true,
    },
    createdAt: capture.createdAt,
  };
}

function decode(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createFieldbookStore({ storage, files, now = () => new Date() }: StoreDependencies) {
  const write = (captures: SavedCapture[]) =>
    storage.setItem(FIELD_BOOK_KEY, JSON.stringify(captures));

  const list = async (): Promise<SavedCapture[]> => {
    const raw = decode(await storage.getItem(FIELD_BOOK_KEY));
    const captures: SavedCapture[] = [];
    let changed = false;

    for (const item of raw) {
      let capture = normalize(item);
      if (!capture) {
        changed = true;
        continue;
      }

      if (!capture.simulated && !capture.imageUri) {
        changed = true;
        continue;
      }

      if (capture.imageUri) {
        const exists = await files.exists(capture.imageUri).catch(() => false);
        if (!exists && !capture.assetId) {
          changed = true;
          continue;
        }

        // Les entrées v1 pointaient souvent vers le cache. Tant que le fichier existe, on le
        // migre sans demander à nouveau Photos. Une URI de photothèque reste externe et intacte.
        const wasVersionTwo = (item as LegacyCapture).schemaVersion === 2;
        if (!wasVersionTwo && exists && !files.isManaged(capture.imageUri)) {
          try {
            capture = {
              ...capture,
              imageUri: await files.copyToDocuments(capture.imageUri, capture.id),
            };
          } catch {
            // Migration tolérante : une entrée encore ouvrable n'est pas perdue si la copie échoue.
          }
        }
      }

      if ((item as LegacyCapture).schemaVersion !== 2) changed = true;
      captures.push(capture);
    }

    const sorted = captures
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, FIELD_BOOK_LIMIT);
    if (changed || sorted.length !== raw.length) await write(sorted);
    return sorted;
  };

  const save = async (input: NewCapture): Promise<SavedCapture> => {
    const createdAt = now();
    const id = `${input.stationId}-${createdAt.getTime()}`;
    const current = await list();
    let durableUri: string | undefined;

    if (!input.simulated) {
      if (!input.imageUri) throw new Error('CAPTURE_URI_MISSING');
      durableUri = await files.copyToDocuments(input.imageUri, id);
    }

    const capture: SavedCapture = {
      ...input,
      schemaVersion: 2,
      id,
      imageUri: durableUri,
      preparation: input.preparation ?? { current: false, reference: false },
      createdAt: createdAt.toISOString(),
    };
    const kept = [capture, ...current].slice(0, FIELD_BOOK_LIMIT);

    try {
      await write(kept);
    } catch (error) {
      if (durableUri) await files.remove(durableUri).catch(() => undefined);
      throw error;
    }

    for (const removed of current.slice(FIELD_BOOK_LIMIT - 1)) {
      if (removed.imageUri && files.isManaged(removed.imageUri)) {
        await files.remove(removed.imageUri).catch(() => undefined);
      }
    }
    return capture;
  };

  const update = async (
    id: string,
    patch: Partial<Pick<SavedCapture, 'assetId' | 'preparation'>>,
  ): Promise<SavedCapture | undefined> => {
    const captures = await list();
    const index = captures.findIndex((capture) => capture.id === id);
    if (index < 0) return undefined;
    captures[index] = { ...captures[index], ...patch };
    await write(captures);
    return captures[index];
  };

  const remove = async (id: string): Promise<boolean> => {
    const captures = await list();
    const capture = captures.find((item) => item.id === id);
    if (!capture) return false;

    await write(captures.filter((item) => item.id !== id));
    if (capture.imageUri && files.isManaged(capture.imageUri)) {
      const exists = await files.exists(capture.imageUri).catch(() => false);
      if (exists) {
        try {
          await files.remove(capture.imageUri);
        } catch (error) {
          // Restaurer la carte évite d'annoncer une suppression si le fichier privé est resté.
          await write(captures);
          throw error;
        }
      }
    }
    return true;
  };

  return { list, remove, save, update };
}
