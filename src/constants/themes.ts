// Jetons sémantiques clair / sombre.
//
// `Palette` reste la liste des teintes brutes de Paris GO ; ici on décrit ce à quoi elles servent.
// Les écrans doivent référencer `theme.surface` plutôt que `Palette.white`, sinon le mode sombre
// reste impossible à câbler — c'est ce qui est arrivé à `Colors.dark`, défini puis jamais importé.

import { Palette } from '@/constants/theme';

export type AppTheme = {
  scheme: 'light' | 'dark';

  /** Fond de l'écran. */
  background: string;
  /** Cartes, feuilles, barres flottantes. */
  surface: string;
  /** Surface posée sur une autre surface (champ de recherche dans une carte). */
  surfaceRaised: string;
  /** Surface d'un élément sélectionné. */
  surfaceSelected: string;

  text: string;
  textSecondary: string;
  /** Texte posé sur un aplat de couleur d'accent. */
  textOnAccent: string;

  line: string;
  accent: string;
  /** Accent secondaire, pour les états actifs et les mises en avant. */
  highlight: string;

  /** Teinte du verre et couleur de repli quand Liquid Glass n'est pas disponible. */
  glassTint: string;
  glassFallback: string;

  /** Statuts de la carte. */
  statusToReprise: string;
  statusPublished: string;
  statusCollection: string;
};

const light: AppTheme = {
  scheme: 'light',
  background: Palette.fog,
  surface: Palette.white,
  surfaceRaised: Palette.white,
  surfaceSelected: Palette.blueMist,
  text: Palette.ink,
  textSecondary: Palette.inkSoft,
  textOnAccent: Palette.white,
  line: Palette.line,
  accent: Palette.parisBlue,
  highlight: Palette.brass,
  glassTint: 'rgba(238, 247, 250, 0.34)',
  glassFallback: 'rgba(247, 251, 252, 0.82)',
  statusToReprise: Palette.copper,
  statusPublished: Palette.lichen,
  statusCollection: Palette.parisBlue,
};

const dark: AppTheme = {
  scheme: 'dark',
  background: Palette.black,
  surface: '#12222D',
  surfaceRaised: '#1B303D',
  surfaceSelected: Palette.parisBlue,
  text: Palette.white,
  textSecondary: '#9DB2BC',
  textOnAccent: Palette.white,
  line: 'rgba(255, 255, 255, 0.12)',
  accent: '#5B9DC4',
  highlight: Palette.brass,
  glassTint: 'rgba(18, 34, 45, 0.42)',
  glassFallback: 'rgba(13, 26, 34, 0.86)',
  // Remontées en luminosité : les teintes claires perdent leur lisibilité sur fond sombre.
  statusToReprise: '#D97B57',
  statusPublished: '#8CA89A',
  statusCollection: '#5B9DC4',
};

export const Themes = { light, dark } as const;
