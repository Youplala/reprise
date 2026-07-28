import { Image, type ImageProps } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { PhotoSource } from '@/hooks/use-image-aspect-ratio';

type AdaptivePhotoProps = {
  source: PhotoSource;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  transition?: ImageProps['transition'];
  blurRadius?: number;
};

export function AdaptivePhoto({
  source,
  style,
  accessibilityLabel,
  transition = 180,
  blurRadius = 24,
}: AdaptivePhotoProps) {
  return (
    <View style={[styles.frame, style]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={blurRadius}
      />
      <View pointerEvents="none" style={styles.backdrop} />
      <Image
        accessibilityLabel={accessibilityLabel}
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={transition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: '#081116',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(8, 17, 22, 0.42)',
  },
});
