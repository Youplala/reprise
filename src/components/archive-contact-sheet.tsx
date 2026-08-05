import type { ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { Palette } from '@/constants/theme';

type ArchiveContactSheetProps = {
  images: readonly ImageSource[];
};

function ContactPhoto({ source }: { source: ImageSource }) {
  return <AdaptivePhoto source={source} style={StyleSheet.absoluteFill} transition={220} />;
}

export function ArchiveContactSheet({ images }: ArchiveContactSheetProps) {
  const visible = images.slice(0, 3);

  if (visible.length === 1) {
    return (
      <View style={styles.sheet}>
        <ContactPhoto source={visible[0]} />
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.lead}>
        <ContactPhoto source={visible[0]} />
      </View>
      <View style={styles.column}>
        {visible.slice(1).map((image, index) => (
          <View key={index} style={styles.secondary}>
            <ContactPhoto source={image} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    backgroundColor: Palette.blueDeep,
  },
  lead: {
    flex: 1.55,
    overflow: 'hidden',
    backgroundColor: Palette.archive,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  secondary: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Palette.archive,
  },
});
