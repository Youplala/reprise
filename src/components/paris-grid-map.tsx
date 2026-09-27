import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Kicker, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { CoverageCell } from '@/utils/mapping-coverage';

const GRID_WIDTH = 760;
const GRID_HEIGHT = 390;
const GRID_PADDING = 8;

// Tracé simplifié de la Seine, d'ouest en est : un repère, pas une carte.
const SEINE: [number, number][] = [
  [2.228, 48.837],
  [2.265, 48.836],
  [2.296, 48.842],
  [2.315, 48.853],
  [2.338, 48.859],
  [2.361, 48.853],
  [2.385, 48.846],
  [2.416, 48.839],
  [2.462, 48.832],
];

type ParisGridMapProps = {
  cells: CoverageCell[];
  /** Nombre de carrés du concours de 1970, affiché dans l'étiquette. */
  squareCount: number;
  height?: number;
};

/**
 * Paris vu comme le concours de 1970 l'a découpé : des carrés de 250 m, verts une fois qu'une
 * photo y a été refaite. Dessiné en SVG plutôt qu'avec une vraie carte, pour rester une
 * illustration lisible d'un coup d'œil, sans rues ni interaction.
 */
export function ParisGridMap({ cells, squareCount, height = 210 }: ParisGridMapProps) {
  const illustration = useMemo(() => {
    if (!cells.length) return undefined;

    const west = Math.min(...cells.map((cell) => cell.bounds[0]));
    const south = Math.min(...cells.map((cell) => cell.bounds[1]));
    const east = Math.max(...cells.map((cell) => cell.bounds[2]));
    const north = Math.max(...cells.map((cell) => cell.bounds[3]));
    const longitudeRatio = Math.cos(((south + north) / 2) * (Math.PI / 180));
    const projectedWidth = (east - west) * longitudeRatio;
    const projectedHeight = north - south;
    const scale = Math.min(
      (GRID_WIDTH - GRID_PADDING * 2) / projectedWidth,
      (GRID_HEIGHT - GRID_PADDING * 2) / projectedHeight,
    );
    const offsetX = (GRID_WIDTH - projectedWidth * scale) / 2;
    const offsetY = (GRID_HEIGHT - projectedHeight * scale) / 2;
    const x = (longitude: number) => offsetX + (longitude - west) * longitudeRatio * scale;
    const y = (latitude: number) => offsetY + (north - latitude) * scale;

    const squares = cells
      .map((cell) => {
        const [cellWest, cellSouth, cellEast, cellNorth] = cell.bounds;
        const fill = cell.published1970 ? Palette.lichen : Palette.blueMist;
        return `<rect x="${x(cellWest).toFixed(2)}" y="${y(cellNorth).toFixed(2)}" width="${Math.max(1, x(cellEast) - x(cellWest)).toFixed(2)}" height="${Math.max(1, y(cellSouth) - y(cellNorth)).toFixed(2)}" rx="0.8" fill="${fill}" stroke="${Palette.parisBlue}" stroke-width="0.8" />`;
      })
      .join('');

    const seine = SEINE.map(
      ([longitude, latitude], index) =>
        `${index ? 'L' : 'M'} ${x(longitude).toFixed(2)} ${y(latitude).toFixed(2)}`,
    ).join(' ');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID_WIDTH}" height="${GRID_HEIGHT}" viewBox="0 0 ${GRID_WIDTH} ${GRID_HEIGHT}"><g>${squares}</g><path d="${seine}" fill="none" stroke="${Palette.white}" stroke-opacity="0.88" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${seine}" fill="none" stroke="#91B7C7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="380" y="206" text-anchor="middle" fill="${Palette.parisBlue}" fill-opacity="0.78" font-family="system-ui" font-size="42" font-weight="800" letter-spacing="9">PARIS</text></svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [cells]);

  const opened = cells.filter((cell) => cell.published1970 > 0).length;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Paris découpé en ${squareCount} carrés de 250 mètres, dont ${opened} où une photo a déjà été refaite.`}
      style={[styles.frame, { height }]}>
      {illustration ? (
        <Image source={{ uri: illustration }} style={styles.image} contentFit="contain" />
      ) : null}
      <View style={styles.titleTag}>
        <Text style={styles.titleText}>
          Paris · {squareCount.toLocaleString('fr-FR')} carrés
        </Text>
      </View>
      <View style={styles.scaleTag}>
        <Text style={styles.scaleText}>250 m</Text>
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, styles.legendDotOpen]} />
        <Text style={styles.legendText}>À refaire</Text>
        <View style={[styles.legendDot, styles.legendDotDone]} />
        <Text style={styles.legendText}>Refait</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  image: {
    position: 'absolute',
    left: Spacing.one,
    right: Spacing.one,
    top: Spacing.four,
    bottom: Spacing.four,
  },
  titleTag: {
    position: 'absolute',
    top: Spacing.twoHalf,
    left: Spacing.twoHalf,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    backgroundColor: Palette.parisBlue,
  },
  titleText: {
    ...Kicker,
    fontSize: 12,
    lineHeight: 14,
    color: Palette.white,
  },
  scaleTag: {
    position: 'absolute',
    left: Spacing.twoHalf,
    bottom: Spacing.twoHalf,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    backgroundColor: Palette.go,
  },
  scaleText: {
    ...Kicker,
    fontSize: 12,
    lineHeight: 14,
    color: Palette.white,
  },
  legend: {
    position: 'absolute',
    right: Spacing.twoHalf,
    bottom: Spacing.twoHalf,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.parisBlue,
  },
  legendDotOpen: {
    backgroundColor: Palette.blueMist,
  },
  legendDotDone: {
    marginLeft: Spacing.one,
    backgroundColor: Palette.lichen,
  },
  legendText: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 14,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
});
