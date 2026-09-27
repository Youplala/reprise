import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Fonts, Palette, Spacing, Stat, Typography } from '@/constants/theme';

export type WaffleSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

const CELLS = 100;
const COLUMNS = 10;

/**
 * Cent carrés, un par point de pourcentage : une proportion se lit en comptant, sans échelle.
 * Une part trop petite pour obtenir un carré garde sa ligne dans la légende, où son effectif
 * exact reste lisible.
 */
export function WaffleChart({ data }: { data: WaffleSlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  // Méthode du plus fort reste : les carrés arrondis totalisent exactement cent.
  const exact = data.map((slice) => (total ? (slice.value / total) * CELLS : 0));
  const cells = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder);
  let missing = total ? CELLS - cells.reduce((sum, count) => sum + count, 0) : 0;
  for (const { index } of order) {
    if (missing <= 0) break;
    cells[index] += 1;
    missing -= 1;
  }

  const colors = data.flatMap((slice, index) => Array.from({ length: cells[index] }, () => slice.color));

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={data
          .map((slice) => `${slice.label} : ${Math.round((slice.value / (total || 1)) * 100)} %`)
          .join(', ')}
        style={styles.grid}>
        {Array.from({ length: CELLS }, (_, index) => {
          // Le remplissage progresse colonne par colonne, comme une jauge qui se remplit.
          const column = index % COLUMNS;
          return (
            <Animated.View
              key={index}
              entering={FadeIn.delay(column * 45 + Math.floor(index / COLUMNS) * 12).duration(260)}
              style={[styles.cell, { backgroundColor: colors[index] ?? Palette.blueMist }]}
            />
          );
        })}
      </View>

      <View style={styles.legend}>
        {data.map((slice) => {
          const share = total ? (slice.value / total) * 100 : 0;
          return (
            <View key={slice.key} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: slice.color }]} />
              <View style={styles.legendCopy}>
                <Text style={styles.legendValue}>
                  {share >= 1 ? `${Math.round(share)} %` : slice.value.toLocaleString('fr-FR')}
                </Text>
                <Text style={styles.legendLabel} numberOfLines={2}>
                  {slice.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  grid: {
    // Dix carrés de 12 et neuf gouttières de 3 : la grille reste carrée.
    width: 147,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legend: {
    flex: 1,
    gap: Spacing.twoHalf,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendCopy: {
    flex: 1,
  },
  legendValue: {
    ...Stat,
    fontSize: 24,
    lineHeight: 28,
    color: Palette.ink,
  },
  legendLabel: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
});
