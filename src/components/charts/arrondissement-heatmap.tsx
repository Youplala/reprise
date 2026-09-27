import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Fonts, Kicker, Palette, Radius, Spacing, Stat, Typography } from '@/constants/theme';

export type ArrondissementCount = {
  /** `75020` */
  code: string;
  count: number;
};

const COLUMNS = 5;
const ARRONDISSEMENTS = Array.from({ length: 20 }, (_, index) => ({
  number: index + 1,
  code: `750${String(index + 1).padStart(2, '0')}`,
}));

function ordinal(number: number) {
  return number === 1 ? '1er' : `${number}e`;
}

/**
 * Les vingt arrondissements en tuiles, de plus en plus orange à mesure qu'on y a refait de
 * photos. Toucher une tuile en affiche le chiffre et le rang ; la plus active est lue d'abord.
 */
export function ArrondissementHeatmap({ data }: { data: ArrondissementCount[] }) {
  const counts = new Map(data.map((entry) => [entry.code, entry.count]));
  const ranked = [...ARRONDISSEMENTS].sort(
    (left, right) => (counts.get(right.code) ?? 0) - (counts.get(left.code) ?? 0),
  );
  const max = Math.max(...ARRONDISSEMENTS.map(({ code }) => counts.get(code) ?? 0), 1);
  const [selectedCode, setSelectedCode] = useState(ranked[0].code);

  const selected = ARRONDISSEMENTS.find(({ code }) => code === selectedCode) ?? ranked[0];
  const selectedCount = counts.get(selected.code) ?? 0;
  const selectedRank = ranked.findIndex(({ code }) => code === selected.code) + 1;

  return (
    <View>
      <View style={styles.readout}>
        <Animated.Text key={selected.code} entering={FadeIn.duration(180)} style={styles.value}>
          {selectedCount.toLocaleString('fr-FR')}
        </Animated.Text>
        <Text style={styles.label}>
          photos · {ordinal(selected.number)} arrondissement · {selectedRank}
          {selectedRank === 1 ? 'er' : 'e'} sur 20
        </Text>
      </View>

      <View style={styles.grid}>
        {ARRONDISSEMENTS.map(({ number, code }, index) => {
          const count = counts.get(code) ?? 0;
          const intensity = count / max;
          const isSelected = code === selected.code;
          const onFill = intensity > 0.45;
          return (
            <Animated.View
              key={code}
              entering={FadeInDown.delay(
                (index % COLUMNS) * 40 + Math.floor(index / COLUMNS) * 60,
              ).duration(320)}
              style={styles.cellWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${ordinal(number)} arrondissement : ${count} photos refaites`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  setSelectedCode(code);
                  void Haptics.selectionAsync();
                }}
                style={({ pressed }) => [
                  styles.cell,
                  { backgroundColor: `rgba(232, 85, 43, ${0.1 + intensity * 0.9})` },
                  isSelected && styles.cellSelected,
                  pressed && styles.cellPressed,
                ]}>
                <Text style={[styles.cellNumber, onFill && styles.onFill]}>{ordinal(number)}</Text>
                <Text style={[styles.cellCount, onFill && styles.onFillSoft]}>{count}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.scale}>
        <Text style={styles.scaleLabel}>Moins</Text>
        {[0.1, 0.32, 0.55, 0.78, 1].map((alpha) => (
          <View
            key={alpha}
            style={[styles.scaleSwatch, { backgroundColor: `rgba(232, 85, 43, ${alpha})` }]}
          />
        ))}
        <Text style={styles.scaleLabel}>Plus</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    marginBottom: Spacing.twoHalf,
  },
  value: {
    ...Stat,
    color: Palette.ink,
  },
  label: {
    ...Typography.caption,
    marginTop: Spacing.half,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -3,
  },
  cellWrap: {
    width: `${100 / COLUMNS}%`,
    padding: 3,
  },
  cell: {
    aspectRatio: 1,
    borderRadius: Radius.small,
    padding: Spacing.two,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: Palette.ink,
  },
  cellPressed: {
    transform: [{ scale: 0.95 }],
  },
  cellNumber: {
    ...Kicker,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0,
    textTransform: 'none',
    color: Palette.ink,
  },
  cellCount: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 14,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  onFill: {
    color: Palette.white,
  },
  onFillSoft: {
    color: 'rgba(255, 255, 255, 0.86)',
  },
  scale: {
    marginTop: Spacing.twoHalf,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  scaleSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  scaleLabel: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
});
