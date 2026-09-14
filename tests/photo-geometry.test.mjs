import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { comparisonDimensionsForAspectRatio } from '../src/services/photo-geometry.ts';

test('portrait comparisons preserve the complete reference aspect ratio', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 9 / 16, 720), {
    width: 360,
    height: 640,
  });
});

test('landscape comparisons preserve the complete reference aspect ratio', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 3 / 2, 720), {
    width: 360,
    height: 240,
  });
});

test('very tall comparisons shrink their width instead of cropping or allocating unbounded height', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 1 / 3, 720), {
    width: 240,
    height: 720,
  });
});

test('malformed comparison ratios use safe fallback dimensions', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 0.001, 720, 280), {
    width: 360,
    height: 280,
  });
  assert.deepEqual(comparisonDimensionsForAspectRatio(0, 9 / 16, 720, 280), {
    width: 0,
    height: 280,
  });
});

test('capture and review screens do not expose the decorative angle meter', async () => {
  const [alignment, review, appConfig] = await Promise.all([
    readFile(new URL('../src/screens/alignment/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/review/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app.json', import.meta.url), 'utf8'),
  ]);

  for (const source of [alignment, review]) {
    assert.doesNotMatch(source, /useDeviceAttitude|rollDegrees|pitchDegrees/);
  }
  assert.doesNotMatch(alignment, /NIVEAU/);
  assert.doesNotMatch(review, /PENCHÉ|APPAREIL DROIT|Tenue de l’appareil/);
  assert.doesNotMatch(appConfig, /expo-sensors|motionPermission/);
});
