import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { authorizeOfficialCapture, isOfficialCaptureAuthorized } from '@/services/official-capture-authority';

import { getSavedCaptures, isSavedCaptureAuthorized, saveCapture } from '@/services/fieldbook';

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
jest.mock('expo-media-library/legacy', () => ({
  createAssetAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('fieldbook', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockReset();
    jest.mocked(MediaLibrary.createAssetAsync).mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(1234));
    await storage.clear();
  });
  afterEach(() => jest.useRealTimers());

  it('copie dans Photos avec l’API compatible Expo 57 et la permission ajout uniquement', async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: true } as never);
    jest.mocked(MediaLibrary.createAssetAsync).mockResolvedValue({ id: 'photos-asset' } as never);
    const photo = new File(Paths.cache, 'fieldbook-photos.jpg');
    photo.create({ overwrite: true });
    photo.write('fixture');
    authorizeOfficialCapture('station-photos', photo.uri);
    const outcome = await saveCapture({ stationId: 'station-photos', frameIndex: 0,
      simulated: false, imageUri: photo.uri });
    expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true, []);
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith(outcome.capture.imageUri);
    expect(outcome.savedToLibrary).toBe(true);
    expect(outcome.capture.assetId).toBe('photos-asset');
  });

  it.each(['denied', 'failed'])('conserve le carnet sans annoncer une copie Photos si %s', async (reason) => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: reason !== 'denied' } as never);
    jest.mocked(MediaLibrary.createAssetAsync).mockRejectedValue(new Error('Native save failed'));
    const photo = new File(Paths.cache, `fieldbook-${reason}.jpg`);
    photo.create({ overwrite: true });
    photo.write('fixture');
    authorizeOfficialCapture(`station-${reason}`, photo.uri);
    const outcome = await saveCapture({ stationId: `station-${reason}`, frameIndex: 0,
      simulated: false, imageUri: photo.uri });
    expect(outcome.savedToLibrary).toBe(false);
    expect(outcome.capture.assetId).toBeUndefined();
    expect(new File(outcome.capture.imageUri!).exists).toBe(true);
    if (reason === 'denied') expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
  });

  it('persiste une capture simulée et la restitue en tête du carnet', async () => {
    const outcome = await saveCapture({
      stationId: 'station-1',
      frameIndex: 0,
      imageUri: 'file:///capture.jpg',
      simulated: true,
      roll: 1.5,
      pitch: -2,
    });

    expect(outcome.savedToLibrary).toBe(false);
    expect(outcome.capture).toMatchObject({
      id: 'station-1-1234',
      imageUri: undefined,
      simulated: true,
    });
    const captures = await getSavedCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]).toMatchObject(outcome.capture);
  });

  it('conserve au maximum les 50 captures les plus récentes', async () => {
    const existing = Array.from({ length: 50 }, (_, index) => ({
      id: `old-${index}`,
      stationId: `station-${index}`,
      simulated: true,
      createdAt: new Date(index).toISOString(),
    }));
    await storage.setItem('reprise.fieldbook.captures.v1', JSON.stringify(existing));

    const { capture } = await saveCapture({ stationId: 'new', frameIndex: 0, simulated: true });
    const saved = await getSavedCaptures();

    expect(saved).toHaveLength(50);
    expect(saved[0]).toMatchObject(capture);
    expect(saved.some(({ id }) => id === 'old-0')).toBe(false);
    expect(saved.some(({ id }) => id === 'old-49')).toBe(true);
  });

  it('ne transforme pas une URI de deep link arbitraire en brouillon autorisé', async () => {
    await expect(saveCapture({ stationId: 'untrusted', frameIndex: 0,
      simulated: false, imageUri: 'file:///private/foreign.jpg' })).rejects.toThrow('CAPTURE_NOT_AUTHORIZED');
    await expect(getSavedCaptures()).resolves.toEqual([]);
  });

  it('reprend la copie privée autorisée après expiration du parcours caméra sans permission Photos', async () => {
    const photo = new File(Paths.cache, 'fieldbook-authorized.jpg');
    photo.create({ overwrite: true });
    photo.write('fixture');
    authorizeOfficialCapture('station-real', photo.uri);
    const { capture, savedToLibrary } = await saveCapture({ stationId: 'station-real',
      frameIndex: 0, simulated: false, imageUri: photo.uri });
    expect(savedToLibrary).toBe(false);
    expect(capture.imageUri).not.toBe(photo.uri);
    jest.setSystemTime(new Date(600000));
    expect(isOfficialCaptureAuthorized('station-real', photo.uri)).toBe(false);
    await expect(isSavedCaptureAuthorized(capture.id, 'station-real', capture.imageUri!)).resolves.toBe(true);
    await expect(isSavedCaptureAuthorized(capture.id, 'station-other', capture.imageUri!)).resolves.toBe(false);
    await expect(isSavedCaptureAuthorized(capture.id, 'station-real', photo.uri)).resolves.toBe(false);
  });
});
