import type { ImageSource } from 'expo-image';

export type StationKind = 'archive-1970' | 'station-2022' | 'recapture-1970';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type StationSummary = {
  id: string;
  name: string;
  arrondissement?: string;
  coordinate: Coordinate;
  kind: StationKind;
  year: 1970 | 2022;
  /** Vrai pour un carré de 1970 : le point est le centre d'une maille de 250 m, pas un point de vue. */
  approximate: boolean;
  source: 'observatoire' | 'archive-local';
  previewImage?: ImageSource;
  frameCount?: number;
  /** `[ouest, sud, est, nord]` — présent sur les carrés de 1970 uniquement. */
  bounds?: [number, number, number, number];
};

export type StationDetail = StationSummary & {
  description?: string;
  address?: string;
  author?: string;
  currentAuthor?: string;
  dateLabel?: string;
  referenceImage?: ImageSource;
  recaptureImage?: ImageSource;
  images: ImageSource[];
  /** Permaliens ARK vers le portail des bibliothèques spécialisées. */
  archiveLinks: string[];
  officialUrl: string;
  hasRecapture: boolean;
  sourceLabel: string;
};

/**
 * L'app lit un instantané embarqué, daté et versionné. Il n'y a plus d'appel réseau au
 * démarrage, donc plus d'état « en ligne » ou « hors ligne » à afficher : seule la date du
 * relevé a du sens pour l'utilisateur.
 */
export type ObservatoireConnection = 'snapshot';
