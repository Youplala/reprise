import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

export type Share = {
  key: string;
  label: string;
  value: number;
  color: string;
};

const SPRING = { damping: 20, stiffness: 120, mass: 0.8 };

function Segment({ share, total, index }: { share: Share; total: number; index: number }) {
  const target = total ? share.value / total : 0;
  const grow = useDerivedValue(() => withDelay(index * 90, withSpring(target, SPRING)), [target, index]);

  const style = useAnimatedStyle(() => ({
    flexGrow: grow.value,
  }));

  return <Animated.View style={[styles.segment, style, { backgroundColor: share.color }]} />;
}

/** Une seule barre découpée en parts, plus lisible qu'un camembert sur un écran de téléphone. */
export function StackedShare({ data }: { data: Share[] }) {
  const total = data.reduce((sum, share) => sum + share.value, 0);

  return (
    <View>
      <View
        accessibilityLabel={data.map((share) => `${share.label} : ${share.value}`).join(', ')}
        style={styles.bar}>
        {data.map((share, index) => (
          <Segment key={share.key} share={share} total={total} index={index} />
        ))}
      </View>

      <View style={styles.legend}>
        {data.map((share) => (
          <View key={share.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: share.color }]} />
            <Text style={styles.legendLabel}>{share.label}</Text>
            <Text style={styles.legendValue}>{share.value.toLocaleString('fr-FR')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 14,
    flexDirection: 'row',
    borderRadius: Radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(22, 63, 91, 0.08)',
  },
  segment: {
    flexBasis: 0,
    height: '100%',
  },
  legend: {
    marginTop: Spacing.twoHalf,
    gap: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  legendValue: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
});
