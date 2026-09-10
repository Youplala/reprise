import type { ImageSource } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';

type ArchiveFilmstripProps = {
  images: readonly ImageSource[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

// Des vignettes agrandies : la pellicule est la promesse d'autres vues à reprendre au même
// endroit, elle mérite plus qu'un liseré discret.
const FRAME_WIDTH = 148;
const FRAME_HEIGHT = 104;

export function ArchiveFilmstrip({ images, selectedIndex, onSelect }: ArchiveFilmstripProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: true,
        x: Math.max(0, selectedIndex * (FRAME_WIDTH + Spacing.two)),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {images.map((image, index) => (
        <Pressable
          key={index}
          accessibilityLabel={`Voir la photo ${index + 1} du secteur`}
          accessibilityRole="button"
          onPress={() => onSelect(index)}
          style={[styles.frame, selectedIndex === index && styles.selectedFrame]}>
          <AdaptivePhoto source={image} style={styles.image} blurRadius={10} />
          <View style={styles.number}>
            <Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    borderRadius: Radius.small,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Palette.archive,
  },
  selectedFrame: {
    borderColor: Palette.brass,
    borderWidth: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  number: {
    position: 'absolute',
    bottom: Spacing.one,
    left: Spacing.one,
    minWidth: 28,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
    backgroundColor: 'rgba(8, 17, 22, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontWeight: '700',
  },
});
