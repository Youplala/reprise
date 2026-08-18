export type SnapshotSyncTrigger = 'startup' | 'foreground' | 'manual';

export type SnapshotSyncResult<T> = {
  snapshot: T;
  checked: boolean;
  lastCheckedAt?: number;
  error?: string;
};

type SnapshotSynchronizerOptions<T> = {
  initialSnapshot: T;
  loadStoredSnapshot: () => Promise<T>;
  refreshSnapshot: (current: T) => Promise<T | undefined>;
  foregroundThrottleMs?: number;
  now?: () => number;
};

const DEFAULT_FOREGROUND_THROTTLE_MS = 5 * 60 * 1_000;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Synchronisation impossible';
}

/**
 * Coordonne tous les déclencheurs de synchronisation : démarrage, retour au premier plan et
 * geste manuel. Une seule requête peut être active et les retours au premier plan sont limités.
 */
export function createSnapshotSynchronizer<T>({
  initialSnapshot,
  loadStoredSnapshot,
  refreshSnapshot,
  foregroundThrottleMs = DEFAULT_FOREGROUND_THROTTLE_MS,
  now = Date.now,
}: SnapshotSynchronizerOptions<T>) {
  let snapshot = initialSnapshot;
  let lastCheckedAt: number | undefined;
  let lastError: string | undefined;
  let inFlight: Promise<SnapshotSyncResult<T>> | undefined;

  const run = async (trigger: SnapshotSyncTrigger): Promise<SnapshotSyncResult<T>> => {
    try {
      if (trigger === 'startup') snapshot = await loadStoredSnapshot();
      const fresher = await refreshSnapshot(snapshot);
      if (fresher) snapshot = fresher;
      lastCheckedAt = now();
      lastError = undefined;
      return { snapshot, checked: true, lastCheckedAt };
    } catch (error) {
      lastCheckedAt = now();
      lastError = errorMessage(error);
      return { snapshot, checked: true, lastCheckedAt, error: lastError };
    }
  };

  const synchronize = (trigger: SnapshotSyncTrigger): Promise<SnapshotSyncResult<T>> => {
    if (inFlight) return inFlight;
    if (
      trigger === 'foreground' &&
      lastCheckedAt !== undefined &&
      now() - lastCheckedAt < foregroundThrottleMs
    ) {
      return Promise.resolve({ snapshot, checked: false, lastCheckedAt, error: lastError });
    }
    inFlight = run(trigger).finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };

  return { synchronize };
}
