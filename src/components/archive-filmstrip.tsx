import type { ImageSource } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

type ArchiveFilmstripProps = {
  images: readonly ImageSource[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function ArchiveFilmstrip({ images, selectedIndex, onSelect }: ArchiveFilmstripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {images.map((image, index) => (
        <Pressable
          key={index}
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  frame: {
    width: 108,
    height: 76,
    borderRadius: Radius.small,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Palette.archive,
  },
  selectedFrame: {
    borderColor: Palette.brass,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  number: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    minWidth: 24,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: Radius.small,
    backgroundColor: 'rgba(8, 17, 22, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '800',
  },
});
