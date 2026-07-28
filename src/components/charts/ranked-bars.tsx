import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

export type RankedEntry = {
  key: string;
  label: string;
  value: number;
};

const SPRING = { damping: 18, stiffness: 130, mass: 0.7 };

function Row({ entry, max, index, color }: { entry: RankedEntry; max: number; index: number; color: string }) {
  const target = max ? entry.value / max : 0;
  const grow = useDerivedValue(() => withDelay(index * 60, withSpring(target, SPRING)), [target, index]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(2, grow.value * 100)}%`,
  }));

  return (
    <View style={styles.row} accessibilityLabel={`${entry.label} : ${entry.value}`}>
      <Text style={styles.label}>{entry.label}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle, { backgroundColor: color }]} />
      </View>
      <Text style={styles.value}>{entry.value.toLocaleString('fr-FR')}</Text>
    </View>
  );
}

/** Classement en barres horizontales, du plus actif au moins actif. */
export function RankedBars({
  data,
  color = Palette.parisBlue,
}: {
  data: RankedEntry[];
  color?: string;
}) {
  const max = Math.max(...data.map((entry) => entry.value), 1);

  return (
    <View style={styles.container}>
      {data.map((entry, index) => (
        <Row key={entry.key} entry={entry} max={max} index={index} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.twoHalf,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  label: {
    width: 34,
    color: Palette.ink,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(22, 63, 91, 0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  value: {
    width: 38,
    textAlign: 'right',
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
});
