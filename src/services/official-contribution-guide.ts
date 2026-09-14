export const OFFICIAL_CONTRIBUTION_GUIDE = [
  {
    icon: 'photo.stack.fill' as const,
    eyebrow: 'ÉTAPE 1 · PHOTOS',
    title: 'Vos deux photos se préparent automatiquement',
    body: 'Paris GO prépare les fichiers pendant que vous découvrez le formulaire officiel.',
    points: [
      'L’archive de 1970 est jointe en premier.',
      'Votre photo actuelle est jointe juste après.',
      'Vérifiez que l’indicateur affiche bien 2/2 photos jointes.',
    ],
  },
  {
    icon: 'text.badge.checkmark' as const,
    eyebrow: 'ÉTAPE 2 · INFORMATIONS',
    title: 'Les données publiques sont préparées',
    body: 'Paris GO remplit uniquement ce qui est certain et utile au dépôt.',
    points: [
      'Adresse, date, position et type d’appareil sont préremplis.',
      'Le commentaire reste vide et entièrement libre.',
      'Relisez tout avant de continuer.',
    ],
  },
  {
    icon: 'hand.raised.fill' as const,
    eyebrow: 'ÉTAPE 3 · VALIDATION',
    title: 'Vous gardez la main jusqu’au bout',
    body: 'Le formulaire appartient à l’Observatoire. Paris GO ne valide rien à votre place.',
    points: [
      'Votre identité reste à saisir par vous-même.',
      'Le règlement et les consentements exigent votre action.',
      'Vous déclenchez l’envoi final, puis la contribution passe en modération.',
    ],
  },
] as const;
