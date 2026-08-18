import assert from 'node:assert/strict';
import test from 'node:test';

import { createSnapshotSynchronizer } from '../src/data/snapshot-sync.ts';

const bundled = { version: '2026-08-11', generatedAt: '2026-08-11T04:00:00Z' };
const cached = { version: '2026-08-12', generatedAt: '2026-08-12T04:00:00Z' };
const remote = { version: '2026-08-18', generatedAt: '2026-08-18T04:00:00Z' };

test('startup adopts the stored snapshot then the fresher remote snapshot', async () => {
  const refreshedWith = [];
  const synchronizer = createSnapshotSynchronizer({
    initialSnapshot: bundled,
    loadStoredSnapshot: async () => cached,
    refreshSnapshot: async (current) => {
      refreshedWith.push(current);
      return remote;
    },
    now: () => 1_000,
  });

  const result = await synchronizer.synchronize('startup');

  assert.deepEqual(refreshedWith, [cached]);
  assert.equal(result.snapshot, remote);
  assert.equal(result.checked, true);
  assert.equal(result.lastCheckedAt, 1_000);
  assert.equal(result.error, undefined);
});

test('foreground checks are throttled while manual checks bypass the throttle', async () => {
  let calls = 0;
  let now = 1_000;
  const synchronizer = createSnapshotSynchronizer({
    initialSnapshot: bundled,
    loadStoredSnapshot: async () => bundled,
    refreshSnapshot: async () => {
      calls += 1;
      return undefined;
    },
    now: () => now,
    foregroundThrottleMs: 5_000,
  });

  await synchronizer.synchronize('startup');
  now = 2_000;
  const throttled = await synchronizer.synchronize('foreground');
  const manual = await synchronizer.synchronize('manual');

  assert.equal(throttled.checked, false);
  assert.equal(manual.checked, true);
  assert.equal(calls, 2);
});

test('a manual check is not swallowed by an immediately throttled foreground trigger', async () => {
  let calls = 0;
  let now = 1_000;
  const synchronizer = createSnapshotSynchronizer({
    initialSnapshot: bundled,
    loadStoredSnapshot: async () => bundled,
    refreshSnapshot: async () => {
      calls += 1;
      return undefined;
    },
    now: () => now,
    foregroundThrottleMs: 5_000,
  });

  await synchronizer.synchronize('startup');
  now = 2_000;
  const foreground = synchronizer.synchronize('foreground');
  const manual = synchronizer.synchronize('manual');
  const [foregroundResult, manualResult] = await Promise.all([foreground, manual]);

  assert.equal(foregroundResult.checked, false);
  assert.equal(manualResult.checked, true);
  assert.equal(calls, 2);
});

test('a throttled foreground trigger joins an active manual refresh', async () => {
  let now = 1_000;
  let resolveRefresh;
  let defer = false;
  const synchronizer = createSnapshotSynchronizer({
    initialSnapshot: bundled,
    loadStoredSnapshot: async () => bundled,
    refreshSnapshot: () => {
      if (!defer) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    },
    now: () => now,
    foregroundThrottleMs: 5_000,
  });

  await synchronizer.synchronize('startup');
  defer = true;
  now = 2_000;
  const manual = synchronizer.synchronize('manual');
  const foreground = synchronizer.synchronize('foreground');

  assert.equal(foreground, manual);
  resolveRefresh(remote);
  assert.equal((await foreground).snapshot, remote);
});

test('concurrent triggers share one network refresh', async () => {
  let resolveRefresh;
  let calls = 0;
  const synchronizer = createSnapshotSynchronizer({
    initialSnapshot: bundled,
    loadStoredSnapshot: async () => bundled,
    refreshSnapshot: () => {
      calls += 1;
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    },
    now: () => 1_000,
  });

  const first = synchronizer.synchronize('manual');
  const second = synchronizer.synchronize('foreground');

  assert.equal(first, second);
  resolveRefresh(remote);
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(firstResult.snapshot, remote);
  assert.equal(secondResult.snapshot, remote);
});

test('network errors remain observable when a foreground check is throttled', async () => {
  let now = 1_000;
  const synchronizer = createSnapshotSynchronizer({
    initialSnapshot: bundled,
    loadStoredSnapshot: async () => bundled,
    refreshSnapshot: async () => {
      throw new Error('hors ligne');
    },
    now: () => now,
    foregroundThrottleMs: 5_000,
  });

  const failed = await synchronizer.synchronize('manual');
  now = 2_000;
  const throttled = await synchronizer.synchronize('foreground');

  assert.equal(failed.error, 'hors ligne');
  assert.equal(throttled.checked, false);
  assert.equal(throttled.error, 'hors ligne');
});

test('network errors keep the current snapshot and become observable', async () => {
  const synchronizer = createSnapshotSynchronizer({
    initialSnapshot: bundled,
    loadStoredSnapshot: async () => bundled,
    refreshSnapshot: async () => {
      throw new Error('hors ligne');
    },
    now: () => 1_000,
  });

  const result = await synchronizer.synchronize('manual');

  assert.equal(result.snapshot, bundled);
  assert.equal(result.checked, true);
  assert.equal(result.lastCheckedAt, 1_000);
  assert.equal(result.error, 'hors ligne');
});
