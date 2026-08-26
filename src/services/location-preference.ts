import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_PREFERENCE_KEY = 'reprise:location-preference:v1';

export type LocationPreference = 'nearby' | 'manual';

export async function getLocationPreference(): Promise<LocationPreference | null> {
  const value = await AsyncStorage.getItem(LOCATION_PREFERENCE_KEY);
  return value === 'nearby' || value === 'manual' ? value : null;
}

export async function setLocationPreference(preference: LocationPreference): Promise<void> {
  await AsyncStorage.setItem(LOCATION_PREFERENCE_KEY, preference);
}

/** Les installations existantes gardent la recherche automatique déjà en place. */
export async function shouldAutoLocate(): Promise<boolean> {
  return (await getLocationPreference()) !== 'manual';
}
