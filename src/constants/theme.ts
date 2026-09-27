import { Platform, type TextStyle } from 'react-native';

/**
 * Palette « mission » : le papier crème et le bleu nuit de l'icône, l'orange du « GO » pour
 * l'action. `go` porte du texte blanc (contraste AA 4,6:1) ; `goBright` est réservé aux jauges,
 * pastilles et traits, où il n'a pas de texte à porter.
 */
export const Palette = {
  ink: '#0D2A3C',
  inkSoft: '#56646B',
  parisBlue: '#153953',
  blueDeep: '#0D2A3C',
  blueMist: '#E8E2D7',
  fog: '#F4F1EC',
  white: '#FFFFFF',
  archive: '#D9D2C4',
  brass: '#F0B642',
  copper: '#CC481C',
  go: '#CC481C',
  goBright: '#E8552B',
  goSoft: '#FBE4DA',
  lichen: '#4F8A6B',
  line: '#DDD5C8',
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

/** Taille minimale d'une cible tactile (HIG). */
export const HitSize = 44;

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

/**
 * Deux rôles hors barème de texte, dans la voix condensée des titres :
 * - `kicker` : l'étiquette au-dessus d'un titre (« MISSION DU JOUR »), en capitales.
 * - `stat`   : un chiffre clé, qui doit se lire avant le texte qui l'accompagne.
 * Ils remplacent les étiquettes en police mono, qui donnaient à l'app un air d'outil technique.
 */
export const Kicker = {
  fontFamily: Fonts.display,
  fontSize: 13,
  lineHeight: 16,
  fontWeight: '700',
  letterSpacing: 0.9,
  textTransform: 'uppercase',
} as const;

export const Stat = {
  fontFamily: Fonts.display,
  fontSize: 34,
  lineHeight: 38,
  fontWeight: '800',
  fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
} as const;

export type TypographyLevel = keyof typeof Typography;
