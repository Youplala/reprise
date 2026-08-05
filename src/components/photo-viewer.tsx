import { Image, type ImageSource } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

type PhotoViewerProps = {
  images: readonly ImageSource[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

export function PhotoViewer({
  images,
  initialIndex,
  visible,
  onClose,
  onIndexChange,
}: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const topBarOffset = Math.max(insets.top, 52) + Spacing.one;
  const bottomBarOffset = Math.max(insets.bottom, 18) + Spacing.two;

  const showInitialImage = () => {
    setCurrentIndex(initialIndex);
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: initialIndex * width, animated: false });
    });
  };

  const updateIndex = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    const boundedIndex = Math.max(0, Math.min(images.length - 1, nextIndex));
    setCurrentIndex(boundedIndex);
    onIndexChange?.(boundedIndex);
  };

  return (
    <Modal
      animationType="fade"
      onShow={showInitialImage}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}>
      <View style={styles.screen}>
        <StatusBar style="light" />

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={updateIndex}
          contentOffset={{ x: initialIndex * width, y: 0 }}>
          {images.map((source, index) => (
            <View key={index} style={{ width, height }}>
              <ScrollView
                bouncesZoom
                centerContent
                maximumZoomScale={5}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                style={styles.zoomSurface}
                contentContainerStyle={{ width, height }}>
                <Image
                  accessibilityLabel={`Photo d’archive ${index + 1} sur ${images.length}`}
                  allowDownscaling={false}
                  contentFit="contain"
                  source={source}
                  style={{ width, height }}
                  transition={120}
                />
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        <View pointerEvents="box-none" style={[styles.topBar, { top: topBarOffset }]}>
          <View style={styles.archiveLabel}>
            <Text style={styles.archiveKicker}>ARCHIVE 1970</Text>
            <Text style={styles.archiveCounter}>
              PHOTO {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Fermer la photo"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <SymbolView name="xmark" size={18} tintColor={Palette.white} />
          </Pressable>
        </View>

        <View pointerEvents="none" style={[styles.bottomBar, { bottom: bottomBarOffset }]}>
          <View style={styles.gestureHint}>
            <SymbolView name="magnifyingglass" size={14} tintColor={Palette.white} />
            <Text style={styles.gestureHintText}>PINCER POUR ZOOMER · BALAYER POUR CHANGER</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.black,
  },
  zoomSurface: {
    flex: 1,
    backgroundColor: Palette.black,
  },
  topBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  archiveLabel: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    backgroundColor: 'rgba(8, 17, 22, 0.76)',
  },
  archiveKicker: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  archiveCounter: {
    marginTop: 3,
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  closeButton: {
    marginTop: Spacing.two,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 17, 22, 0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.34)',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gestureHint: {
    minHeight: 34,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(8, 17, 22, 0.76)',
  },
  gestureHintText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
});
