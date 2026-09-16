import { Platform } from 'react-native';

export const Palette = {
  ink: '#17262F',
  inkSoft: '#4D606A',
  parisBlue: '#163F5B',
  blueDeep: '#0D2A3C',
  blueMist: '#DDE8EC',
  fog: '#EDF2F3',
  white: '#FFFFFF',
  archive: '#D9D2C4',
  brass: '#F0B642',
  copper: '#B95F3E',
  lichen: '#70897C',
  line: '#CBD7DA',
  danger: '#A13C32',
  black: '#081116',
} as const;

export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.fog,
    backgroundElement: Palette.white,
    backgroundSelected: Palette.blueMist,
    textSecondary: Palette.inkSoft,
  },
  dark: {
    text: Palette.white,
    background: Palette.black,
    backgroundElement: Palette.blueDeep,
    backgroundSelected: Palette.parisBlue,
    textSecondary: Palette.blueMist,
  },
} as const;

export type ThemeColor = keyof (typeof Colors)['light'];

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    display: 'Avenir Next Condensed',
    serif: 'New York',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    display: 'sans-serif-condensed',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    display: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  twoHalf: 12,
  three: 16,
  threeHalf: 20,
  four: 24,
  five: 32,
  fiveHalf: 40,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/**
 * Espace à réserver au bas des vues défilantes. La barre d'onglets flotte au-dessus du contenu :
 * sans cette marge, le dernier bloc de chaque écran passe dessous et devient inatteignable.
 */
export const TabBarClearance = Platform.select({ ios: 132, android: 124 }) ?? 128;
export const MaxContentWidth = 800;

export const Radius = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const Shadow = {
  card: {
    shadowColor: Palette.blueDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
} as const;

/**
 * Échelle typographique — trois niveaux de hiérarchie au maximum par écran.
 *
 * Avant cette échelle, l'application déclarait 36 tailles de police distinctes sur
 * 312 usages, dont une majorité entre 7 et 10 px : le texte était illisible et la
 * hiérarchie indéchiffrable. Toute nouvelle taille doit passer par ce barème.
 *
 * - `display` : le titre d'un écran, une seule fois par vue, jamais avec `title`.
 * - `title`   : les têtes de section et les noms de lieux.
 * - `body`    : le texte courant. C'est la taille par défaut.
 * - `caption` : les métadonnées et les crédits, jamais pour une information nécessaire.
 */
export const Typography = {
  display: { fontSize: 30, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyLevel = keyof typeof Typography;
