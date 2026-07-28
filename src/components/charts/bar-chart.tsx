import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useDerivedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

export type Bar = {
  key: string;
  label: string;
  value: number;
};

type BarChartProps = {
  data: Bar[];
  height?: number;
  accentColor?: string;
  /** Suffixe de l'infobulle, par exemple « reprises ». */
  unit?: string;
};

const SPRING = { damping: 16, stiffness: 140, mass: 0.7 };

function Column({
  bar,
  max,
  index,
  height,
  accentColor,
  selected,
  onSelect,
}: {
  bar: Bar;
  max: number;
  index: number;
  height: number;
  accentColor: string;
  selected: boolean;
  onSelect: () => void;
}) {
  // Les barres poussent en cascade : l'œil suit la progression au lieu de tout voir surgir.
  const target = max ? Math.max(0.04, bar.value / max) : 0;
  const grow = useDerivedValue(() => withDelay(index * 70, withSpring(target, SPRING)), [target, index]);

  const barStyle = useAnimatedStyle(() => ({
    height: grow.value * height,
  }));

  return (
    <Pressable
      accessibilityLabel={`${bar.label} : ${bar.value}`}
      accessibilityRole="button"
      onPress={onSelect}
      style={styles.column}>
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.bar,
            barStyle,
            { backgroundColor: selected ? Palette.brass : accentColor },
          ]}
        />
      </View>
      <Text style={[styles.columnLabel, selected && styles.columnLabelActive]} numberOfLines={1}>
        {bar.label}
      </Text>
    </Pressable>
  );
}

/** Histogramme vertical, une barre par période. Toucher une barre en révèle la valeur. */
export function BarChart({ data, height = 132, accentColor = Palette.parisBlue, unit }: BarChartProps) {
  const [selectedKey, setSelectedKey] = useState<string>();
  const max = Math.max(...data.map((bar) => bar.value), 1);
  const selected = data.find((bar) => bar.key === selectedKey) ?? data[data.length - 1];

  return (
    <View>
      <View style={styles.readout}>
        <Animated.Text key={selected?.key} entering={FadeIn.duration(180)} style={styles.readoutValue}>
          {selected ? selected.value.toLocaleString('fr-FR') : '—'}
        </Animated.Text>
        <Text style={styles.readoutLabel}>
          {unit ? `${unit} · ` : ''}
          {selected?.label ?? ''}
        </Text>
      </View>

      <View style={styles.row}>
        {data.map((bar, index) => (
          <Column
            key={bar.key}
            bar={bar}
            max={max}
            index={index}
            height={height}
            accentColor={accentColor}
            selected={bar.key === selected?.key}
            onSelect={() => {
              setSelectedKey(bar.key);
              void Haptics.selectionAsync();
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    marginBottom: Spacing.twoHalf,
  },
  readoutValue: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 30,
  },
  readoutLabel: {
    marginTop: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  track: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: Radius.small,
    minHeight: 4,
  },
  columnLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  columnLabelActive: {
    color: Palette.ink,
    fontWeight: '800',
  },
});
