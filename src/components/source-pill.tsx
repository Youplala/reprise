import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';

type SourcePillProps = {
  /** Date du relevé, au format ISO court (`2026-07-28`). */
  version?: string;
  label?: string;
  inverse?: boolean;
};

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function formatVersion(version?: string) {
  if (!version) return undefined;
  const date = new Date(`${version}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : `Relevé du ${dateFormat.format(date)}`;
}

/**
 * Indique d'où viennent les données. Comme l'app lit un instantané embarqué, afficher
 * « source en direct » serait faux : c'est la date du relevé qui renseigne l'utilisateur.
 */
export function SourcePill({ version, label, inverse = false }: SourcePillProps) {
  return (
    <View style={[styles.container, inverse && styles.inverse]}>
      <View style={styles.dot} />
      <Text style={[styles.label, inverse && styles.inverseLabel]}>
        {label ?? formatVersion(version) ?? 'Données de l’Observatoire'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '100%',
    flexShrink: 1,
    minHeight: 28,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  inverse: {
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
  },
  dot: {
    flexShrink: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Palette.lichen,
  },
  label: {
    flexShrink: 1,
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inverseLabel: {
    color: Palette.white,
  },
});
