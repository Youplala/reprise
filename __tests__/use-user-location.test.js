import React, { useEffect } from 'react';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import * as Location from 'expo-location';

import { useUserLocation } from '@/hooks/use-user-location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('@/services/location-preference', () => ({ shouldAutoLocate: async () => false }));

let current;
let renderer;
function Probe() {
  const location = useUserLocation();
  useEffect(() => { current = location; }, [location]);
  return null;
}

beforeEach(async () => {
  jest.useFakeTimers();
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
  Location.hasServicesEnabledAsync.mockResolvedValue(true);
  Location.getCurrentPositionAsync.mockImplementation(() => new Promise(() => {}));
  await act(async () => { renderer = create(<Probe />); });
});
afterEach(async () => {
  await act(async () => { renderer.unmount(); });
  jest.clearAllMocks();
  jest.useRealTimers();
});

it('libère la recherche et le bouton quand le GPS ne répond jamais', async () => {
  await act(async () => { void current.locate(); });
  expect(current.loading).toBe(true);
  await act(async () => { await jest.advanceTimersByTimeAsync(15000); });
  expect(current.loading).toBe(false);
  expect(current.isPrecise).toBe(false);
  expect(current.error).toBeTruthy();
});

it('ignore une position tardive après expiration et permet une nouvelle recherche', async () => {
  let resolveOld;
  Location.getCurrentPositionAsync.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  await act(async () => { void current.locate(); });
  await act(async () => { await jest.advanceTimersByTimeAsync(15000); });
  Location.getCurrentPositionAsync.mockResolvedValueOnce({ coords: { latitude: 48.88, longitude: 2.3 } });
  await act(async () => { await current.locate(); });
  await act(async () => { resolveOld({ coords: { latitude: 0, longitude: 0 } }); });
  expect(current.coordinate).toEqual({ latitude: 48.88, longitude: 2.3 });
  expect(current.isPrecise).toBe(true);
  expect(current.loading).toBe(false);
});

it('termine immédiatement si la permission est refusée', async () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false });
  await act(async () => { await current.locate(); });
  expect(current.loading).toBe(false);
  expect(current.isPrecise).toBe(false);
  expect(current.error).toBe('Position non autorisée');
});

it('termine si les services de localisation sont désactivés', async () => {
  Location.hasServicesEnabledAsync.mockResolvedValueOnce(false);
  await act(async () => { void current.locate(); });
  expect(current.loading).toBe(false);
  expect(current.error).toBeTruthy();
});
