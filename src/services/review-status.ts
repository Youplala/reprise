export type CaptureLocation = {
  latitude: number;
  longitude: number;
  precision: 'precise' | 'approximate';
};

export type ReviewStatusIcon =
  | 'checkmark.circle.fill'
  | 'exclamationmark.circle.fill'
  | 'info.circle.fill';

export type ReviewStatusRow = {
  icon: ReviewStatusIcon;
  title: string;
  copy: string;
};

type ReviewStatusInput = {
  simulated: boolean;
  location?: CaptureLocation;
  saved: boolean;
  savedToLibrary: boolean;
};

function locationStatus(simulated: boolean, location?: CaptureLocation): ReviewStatusRow {
  if (simulated) {
    return {
      icon: 'info.circle.fill',
      title: 'Lieu',
      copy: 'Mode démo : aucune position enregistrée',
    };
  }
  if (!location) {
    return {
      icon: 'exclamationmark.circle.fill',
      title: 'Lieu',
      copy: 'Position non enregistrée pour cette capture',
    };
  }
  return {
    icon: location.precision === 'precise' ? 'checkmark.circle.fill' : 'info.circle.fill',
    title: 'Lieu',
    copy:
      location.precision === 'precise'
        ? 'Position précise enregistrée avec cette capture'
        : 'Position approximative enregistrée avec cette capture',
  };
}

function fileStatus(simulated: boolean): ReviewStatusRow {
  return simulated
    ? {
        icon: 'info.circle.fill',
        title: 'Fichier',
        copy: 'Image de démonstration, aucune photo créée',
      }
    : {
        icon: 'info.circle.fill',
        title: 'Fichier',
        copy: 'JPEG recadré et réencodé pour la comparaison',
      };
}

function storageStatus({ simulated, saved, savedToLibrary }: ReviewStatusInput): ReviewStatusRow {
  if (simulated && saved) {
    return {
      icon: 'info.circle.fill',
      title: 'Conservation',
      copy: 'Aperçu ajouté au carnet, sans fichier photo',
    };
  }
  if (savedToLibrary) {
    return {
      icon: 'checkmark.circle.fill',
      title: 'Conservation',
      copy: 'Carnet créé et copie ajoutée à Photos',
    };
  }
  if (saved) {
    return {
      icon: 'exclamationmark.circle.fill',
      title: 'Conservation',
      copy: 'Carnet créé, mais aucune copie durable confirmée',
    };
  }
  return {
    icon: 'exclamationmark.circle.fill',
    title: 'Conservation',
    copy: simulated
      ? 'Aperçu pas encore ajouté au carnet'
      : 'Photo pas encore enregistrée dans le carnet ni dans Photos',
  };
}

export function getReviewStatusRows(input: ReviewStatusInput): ReviewStatusRow[] {
  return [locationStatus(input.simulated, input.location), fileStatus(input.simulated), storageStatus(input)];
}