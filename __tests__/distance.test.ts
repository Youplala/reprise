import { distanceInMeters, formatDistance } from '@/utils/distance';

describe('distance utilities', () => {
  it('retourne zéro entre deux coordonnées identiques', () => {
    expect(distanceInMeters({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 48.8566, longitude: 2.3522 })).toBe(0);
  });

  it('formate les distances courtes et kilométriques', () => {
    expect(formatDistance(42)).toBe('40 m');
    expect(formatDistance(1_250)).toBe('1.3 km');
  });
});
