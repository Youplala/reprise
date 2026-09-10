import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Fonts, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';

export const TIMELINE_YEARS = [1970, 2022, 2026] as const;

export type TimelineYear = (typeof TIMELINE_YEARS)[number];

const ERA_LABEL: Record<TimelineYear, string> = {
  1970: 'Archive',
  2022: 'Campagne 2022',
  2026: 'Aujourd’hui',
};

type TimeTravelSliderProps = {
  activeYear: TimelineYear;
  availableYears: TimelineYear[];
  onSelect: (year: TimelineYear) => void;
};

/**
 * Un seul repère suffit à situer l'époque affichée : glisser le curseur est sa propre
 * explication, pas besoin d'un titre et d'un mode d'emploi à côté.
 */
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
        <Text style={styles.label}>
          {activeYear} · {ERA_LABEL[activeYear]}
        </Text>

        <Slider
          accessibilityLabel="Choisir une époque"
          accessibilityValue={{ text: `${activeYear} · ${ERA_LABEL[activeYear]}` }}
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
    paddingBottom: Spacing.two,
  },
  label: {
    ...Typography.caption,
    alignSelf: 'center',
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  slider: {
    width: '100%',
    height: 30,
    marginTop: Spacing.one,
  },
});
