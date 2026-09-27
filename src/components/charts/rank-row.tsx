import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Fonts, Kicker, Palette, Radius, Spacing, Typography } from '@/constants/theme';

const SPRING = { damping: 18, stiffness: 130, mass: 0.7 };
/** Le podium prend l'orange de la mission ; le reste du classement reste bleu nuit. */
const PODIUM = 3;

type RankRowProps = {
  rank: number;
  label: string;
  count: number;
  max: number;
  unit: string;
  first?: boolean;
  last?: boolean;
  onPress?: () => void;
};

/**
 * Une ligne de classement : rang, nom, effectif et une barre proportionnelle au premier. Les
 * lignes s'empilent en une carte blanche unique, arrondie en haut de la première et en bas de
 * la dernière.
 */
export function RankRow({ rank, label, count, max, unit, first, last, onPress }: RankRowProps) {
  const target = max ? count / max : 0;
  const grow = useDerivedValue(
    () => withDelay(Math.min(rank, 8) * 50, withSpring(target, SPRING)),
    [target, rank],
  );
  const fillStyle = useAnimatedStyle(() => ({
    width: `${count ? Math.max(2, grow.value * 100) : 0}%`,
  }));
  const podium = rank <= PODIUM;

  const content = (
    <>
      <Text style={[styles.rank, podium && styles.rankPodium]}>{rank}</Text>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.count}>{count.toLocaleString('fr-FR')}</Text>
        </View>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              fillStyle,
              { backgroundColor: podium ? Palette.goBright : Palette.parisBlue },
            ]}
          />
        </View>
      </View>
      {onPress ? <SymbolView name="chevron.right" size={12} tintColor={Palette.inkSoft} /> : null}
    </>
  );

  const rowStyle = [styles.row, first && styles.first, last && styles.last];
  const accessibilityLabel = `${rank}. ${label} : ${count} ${unit}`;

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={rowStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.line,
  },
  first: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
  },
  last: {
    borderBottomLeftRadius: Radius.large,
    borderBottomRightRadius: Radius.large,
    borderBottomWidth: 0,
  },
  pressed: {
    backgroundColor: Palette.blueMist,
  },
  rank: {
    ...Kicker,
    width: 28,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
    color: Palette.inkSoft,
    textAlign: 'center',
  },
  rankPodium: {
    color: Palette.go,
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    ...Typography.body,
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  count: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueMist,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
});
