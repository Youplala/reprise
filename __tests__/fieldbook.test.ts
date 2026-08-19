import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSavedCaptures, saveCapture } from '@/services/fieldbook';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-media-library', () => ({
  addAssetsToAlbumAsync: jest.fn(),
  createAlbumAsync: jest.fn(),
  createAssetAsync: jest.fn(),
  getAlbumAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('fieldbook', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await storage.clear();
  });

  it('persiste une capture simulée et la restitue en tête du carnet', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1234);

    const outcome = await saveCapture({
      stationId: 'station-1',
      imageUri: 'file:///capture.jpg',
      simulated: true,
      roll: 1.5,
      pitch: -2,
    });

    expect(outcome.savedToLibrary).toBe(false);
    expect(outcome.capture).toMatchObject({
      id: 'station-1-1234',
      imageUri: 'file:///capture.jpg',
      simulated: true,
    });
    await expect(getSavedCaptures()).resolves.toEqual([outcome.capture]);
  });

  it('conserve au maximum les 50 captures les plus récentes', async () => {
    const existing = Array.from({ length: 50 }, (_, index) => ({
      id: `old-${index}`,
      stationId: `station-${index}`,
      simulated: true,
      createdAt: new Date(index).toISOString(),
    }));
    await storage.setItem('reprise.fieldbook.captures.v1', JSON.stringify(existing));

    const { capture } = await saveCapture({ stationId: 'new', simulated: true });
    const saved = await getSavedCaptures();

    expect(saved).toHaveLength(50);
    expect(saved[0]).toEqual(capture);
    expect(saved.some(({ id }) => id === 'old-49')).toBe(false);
  });
});
