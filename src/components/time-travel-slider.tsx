import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

export const TIMELINE_YEARS = [1970, 2022, 2026] as const;

export type TimelineYear = (typeof TIMELINE_YEARS)[number];

type TimeTravelSliderProps = {
  activeYear: TimelineYear;
  availableYears: TimelineYear[];
  onSelect: (year: TimelineYear) => void;
};

export function TimeTravelSlider({
  activeYear,
  availableYears,
  onSelect,
}: TimeTravelSliderProps) {
  const visibleYears = TIMELINE_YEARS.filter((year) => availableYears.includes(year));
  const activeSlot = Math.max(0, visibleYears.indexOf(activeYear));
  const lastSlot = useRef(activeSlot);

  useEffect(() => {
    lastSlot.current = activeSlot;
  }, [activeSlot]);

  if (visibleYears.length < 2) return null;

  const selectSlot = (rawSlot: number) => {
    const slot = Math.max(0, Math.min(visibleYears.length - 1, Math.round(rawSlot)));
    if (slot === lastSlot.current) return;
    lastSlot.current = slot;
    void Haptics.selectionAsync();
    onSelect(visibleYears[slot]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.kicker}>VOYAGE DANS LE TEMPS</Text>
        <Text style={styles.hint}>Glissez entre les campagnes</Text>
      </View>

      <Slider
        accessibilityLabel="Choisir une époque"
        accessibilityValue={{ text: String(activeYear) }}
        style={styles.slider}
        value={activeSlot}
        minimumValue={0}
        maximumValue={visibleYears.length - 1}
        step={1}
        minimumTrackTintColor={Palette.brass}
        maximumTrackTintColor="rgba(255,255,255,0.28)"
        thumbTintColor={Palette.white}
        onValueChange={selectSlot}
      />

      <View style={styles.labels}>
        {visibleYears.map((year, index) => {
          const active = year === activeYear;
          return (
            <Pressable
              accessibilityHint="Affiche la photographie de cette époque"
              accessibilityLabel={String(year)}
              accessibilityRole="button"
              key={year}
              onPress={() => {
                if (lastSlot.current !== index) {
                  lastSlot.current = index;
                  void Haptics.selectionAsync();
                }
                onSelect(year);
              }}
              style={styles.labelButton}>
              <View
                style={[
                  styles.tick,
                  styles.tickAvailable,
                  active && styles.tickActive,
                ]}
              />
              <Text style={[styles.year, active && styles.yearActive]}>
                {year}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.twoHalf,
    backgroundColor: Palette.blueDeep,
    borderBottomLeftRadius: Radius.large,
    borderBottomRightRadius: Radius.large,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  kicker: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  hint: {
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    fontSize: 10,
  },
  slider: {
    width: '100%',
    height: 28,
    marginTop: 3,
  },
  labels: {
    marginTop: -2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelButton: {
    minWidth: 54,
    alignItems: 'center',
    gap: 4,
  },
  tick: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  tickAvailable: {
    backgroundColor: Palette.white,
    borderColor: Palette.white,
  },
  tickActive: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: -2,
    backgroundColor: Palette.brass,
    borderColor: Palette.brass,
  },
  year: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
  },
  yearActive: {
    color: Palette.brass,
  },
});
