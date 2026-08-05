import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';

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
      <GlassSurface variant="regular" tintColor="rgba(13, 42, 60, 0.88)" />
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.kicker}>VOYAGE DANS LE TEMPS</Text>
          <Text style={styles.hint}>Glissez entre les époques</Text>
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
                style={({ pressed }) => [styles.labelButton, pressed && styles.pressed]}>
                <Text style={[styles.year, active && styles.yearActive]}>{year}</Text>
                <Text style={[styles.yearCaption, active && styles.yearCaptionActive]}>
                  {year === 1970 ? 'ARCHIVE' : year === 2022 ? 'CAMPAGNE' : 'AUJOURD’HUI'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.three,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
    ...Shadow.card,
  },
  content: {
    paddingTop: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.twoHalf,
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
    height: 30,
    marginTop: 3,
  },
  labels: {
    marginTop: -1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelButton: {
    minWidth: 64,
  },
  year: {
    color: Palette.blueMist,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
  },
  yearActive: {
    color: Palette.brass,
  },
  yearCaption: {
    marginTop: 1,
    color: 'rgba(221,232,236,0.62)',
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  yearCaptionActive: {
    color: Palette.white,
  },
  pressed: {
    opacity: 0.72,
  },
});
