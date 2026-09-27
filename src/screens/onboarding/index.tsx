import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { ParisGridMap } from '@/components/paris-grid-map';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
import {
  Fonts,
  HitSize,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Stat,
  Typography,
} from '@/constants/theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useStations } from '@/providers/stations-provider';
import { trySetLocationPreference } from '@/services/location-preference';
import {
  completeOnboarding,
  HISTORIC_GRID_COUNT,
  LOCATION_PRIVACY_COPY,
} from '@/services/onboarding';
import type { StationDetail } from '@/types/station';

const appIcon = require('../../../assets/images/parisgo-app-icon.png');

/**
 * Trois pages, une idée chacune : ce qu'est l'app (l'avant/après), ce qu'on y fait (la mission),
 * et d'où l'on part (sa position). Chaque page porte un visuel, un titre, une phrase et une seule
 * action : le détail — légende de la carte, étapes du dépôt — s'apprend là où il sert.
 */
const PAGES = ['welcome', 'mission', 'location'] as const;
type Page = (typeof PAGES)[number];

const CTA_LABELS: Record<Page, string> = {
  welcome: 'Commencer',
  mission: 'Continuer',
  location: 'Activer la localisation',
};

type OnboardingScreenProps = {
  onComplete: () => void;
};

function Heading({ kicker, title, copy }: { kicker: string; title: string; copy?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {copy ? <Text style={styles.copy}>{copy}</Text> : null}
    </View>
  );
}

function WelcomeHero({
  pair,
  height,
  playIntro,
  onInteractionChange,
}: {
  pair?: StationDetail;
  height: number;
  playIntro: boolean;
  onInteractionChange: (active: boolean) => void;
}) {
  if (!pair?.referenceImage || !pair.recaptureImage) {
    return (
      <View style={[styles.heroFallback, { height }]}>
        <SymbolView name="photo.on.rectangle.angled" size={36} tintColor={Palette.go} />
      </View>
    );
  }

  return (
    <View>
      <BeforeAfterSlider
        before={pair.referenceImage}
        after={pair.recaptureImage}
        beforeLabel={String(pair.year)}
        afterLabel="2026"
        borderRadius={Radius.large}
        height={height}
        playIntro={playIntro}
        onInteractionChange={onInteractionChange}
      />
      <View pointerEvents="none" style={styles.swipeHint}>
        <SymbolView name="hand.draw.fill" size={14} tintColor={Palette.white} />
        <Text style={styles.swipeHintText}>Glissez pour comparer</Text>
      </View>
    </View>
  );
}

function MissionStep({
  icon,
  title,
  copy,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  copy: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}>
        <SymbolView name={icon} size={20} tintColor={Palette.go} />
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{copy}</Text>
      </View>
    </View>
  );
}

// Positions des vignettes autour du repère, en fraction du diamètre du radar.
const RADAR_THUMBS = [
  { x: 0.08, y: 0.1, rotate: '-6deg' },
  { x: 0.7, y: 0.02, rotate: '5deg' },
  { x: 0.76, y: 0.62, rotate: '-4deg' },
  { x: 0.02, y: 0.66, rotate: '4deg' },
] as const;

/** Un repère qui pulse au milieu des photos de 1970 : « il y en a autour de vous ». */
function Radar({ images, size }: { images: ImageSource[]; size: number }) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [pulse, reducedMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 2.2 }],
  }));

  const thumb = Math.round(size * 0.24);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.radar, { width: size, height: size }]}>
      {[1, 0.7, 0.4].map((ratio) => (
        <View
          key={ratio}
          style={[
            styles.radarRing,
            {
              width: size * ratio,
              height: size * ratio,
              borderRadius: (size * ratio) / 2,
            },
          ]}
        />
      ))}
      <Animated.View style={[styles.radarPulse, pulseStyle]} />
      <View style={styles.radarPin}>
        <SymbolView name="location.fill" size={24} tintColor={Palette.white} />
      </View>
      {images.slice(0, RADAR_THUMBS.length).map((source, index) => {
        const position = RADAR_THUMBS[index];
        return (
          <View
            key={index}
            style={[
              styles.radarThumb,
              {
                width: thumb,
                height: thumb,
                left: position.x * size,
                top: position.y * size,
                transform: [{ rotate: position.rotate }],
              },
            ]}>
            <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
        );
      })}
    </View>
  );
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { width, height } = useWindowDimensions();
  const { publishedSubmissions, coverage, grid } = useStations();
  const { locate, loading: locating } = useUserLocation();
  const listRef = useRef<FlatList<Page>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const heroHeight = Math.min(400, Math.max(240, height * 0.37));
  const gridHeight = Math.min(260, Math.max(190, height * 0.28));
  const radarSize = Math.min(270, width - Spacing.five * 2, height * 0.3);
  const finalPage = pageIndex === PAGES.length - 1;
  const percentageLabel = coverage.percentage.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  });
  const radarImages = publishedSubmissions
    .map((submission) => submission.referenceImage)
    .filter((image): image is ImageSource => Boolean(image))
    .slice(1, 1 + RADAR_THUMBS.length);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await completeOnboarding();
    } finally {
      onComplete();
    }
  };

  const findFirstPhoto = async () => {
    if (finishing || locating) return;
    await trySetLocationPreference('nearby');
    const coordinate = await locate();
    if (!coordinate) await trySetLocationPreference('manual');
    await finish();
  };

  const exploreWithoutLocation = async () => {
    if (finishing) return;
    await trySetLocationPreference('manual');
    await finish();
  };

  const goTo = (index: number) => {
    void Haptics.selectionAsync();
    listRef.current?.scrollToIndex({ index, animated: true });
    setPageIndex(index);
  };

  const handlePrimary = () => {
    if (finalPage) {
      void findFirstPhoto();
      return;
    }
    goTo(pageIndex + 1);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const renderPage = ({ item }: { item: Page }) => {
    const isActive = PAGES[pageIndex] === item;
    const pageProps = {
      accessibilityElementsHidden: !isActive,
      importantForAccessibility: isActive ? ('auto' as const) : ('no-hide-descendants' as const),
      style: { width },
      contentContainerStyle: styles.page,
      showsVerticalScrollIndicator: false,
    };

    if (item === 'welcome') {
      return (
        <ScrollView {...pageProps}>
          <WelcomeHero
            pair={publishedSubmissions[0]}
            height={heroHeight}
            playIntro={isActive}
            onInteractionChange={(active) => setPagerScrollEnabled(!active)}
          />
          <Heading
            kicker="Bienvenue dans Paris GO"
            title="Retrouvez le Paris de 1970."
            copy="En 1970, des Parisiens ont photographié leur ville. Refaites leurs photos, au même endroit, aujourd’hui."
          />
        </ScrollView>
      );
    }

    if (item === 'mission') {
      return (
        <ScrollView {...pageProps}>
          <ParisGridMap cells={grid} squareCount={HISTORIC_GRID_COUNT} height={gridHeight} />

          <View style={styles.missionProgress}>
            <View style={styles.missionHead}>
              <Text style={styles.missionKicker}>La mission collective</Text>
              <Text style={styles.missionValue}>{percentageLabel} %</Text>
            </View>
            <ProgressBar percentage={coverage.percentage} height={10} />
            <Text style={styles.missionDetail}>
              {coverage.published1970.toLocaleString('fr-FR')} photos refaites sur{' '}
              {coverage.total1970.toLocaleString('fr-FR')}. À vous de faire monter ce chiffre.
            </Text>
          </View>

          <View style={styles.steps}>
            <MissionStep
              icon="map.fill"
              title="Trouvez une photo"
              copy="Choisissez un carré près de vous."
            />
            <MissionStep
              icon="camera.viewfinder"
              title="Cadrez comme en 1970"
              copy="Le viseur superpose l’archive."
            />
            <MissionStep
              icon="paperplane.fill"
              title="Partagez votre reprise"
              copy="Déposez-la à l’Observatoire."
            />
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView {...pageProps}>
        <View style={styles.radarWrap}>
          <Radar images={radarImages} size={radarSize} />
        </View>
        <Heading
          kicker="Autour de vous"
          title="Commencez près de vous."
          copy="Paris GO vous montre d’abord les photos de 1970 prises à quelques rues."
        />
        <View style={styles.privacy}>
          <SymbolView name="lock.fill" size={14} tintColor={Palette.lichen} />
          <Text style={styles.privacyText}>{LOCATION_PRIVACY_COPY}</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <StatusBar style="dark" animated />
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={appIcon} style={styles.brandIcon} contentFit="cover" />
          <Text style={styles.brandText}>Paris GO</Text>
        </View>
        {!finalPage ? (
          <Pressable
            accessibilityLabel="Passer au choix de localisation"
            accessibilityRole="button"
            onPress={() => goTo(PAGES.length - 1)}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <Text style={styles.skipText}>Passer</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        extraData={pageIndex}
        renderItem={renderPage}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        scrollEnabled={pagerScrollEnabled}
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      <View style={styles.footer}>
        <View
          accessibilityLabel={`Étape ${pageIndex + 1} sur ${PAGES.length}`}
          accessibilityRole="progressbar"
          style={styles.dots}>
          {PAGES.map((page, index) => (
            <View key={page} style={[styles.dot, index === pageIndex && styles.dotActive]} />
          ))}
        </View>
        <PrimaryButton
          label={CTA_LABELS[PAGES[pageIndex]]}
          icon={finalPage ? 'location.fill' : 'arrow.right'}
          loading={finishing || locating}
          onPress={handlePrimary}
        />
        {finalPage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explorer Paris sans utiliser ma position"
            disabled={finishing}
            onPress={() => void exploreWithoutLocation()}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Explorer sans localisation</Text>
          </Pressable>
        ) : (
          <View style={styles.secondary} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  brandText: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  skip: {
    minWidth: HitSize,
    minHeight: HitSize,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    ...Typography.body,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.55,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },

  heading: {
    marginTop: Spacing.threeHalf,
    gap: Spacing.two,
  },
  kicker: {
    ...Kicker,
    color: Palette.go,
  },
  title: {
    ...Typography.display,
    fontSize: 32,
    lineHeight: 36,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  copy: {
    ...Typography.body,
    fontSize: 17,
    lineHeight: 24,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },

  heroFallback: {
    borderRadius: Radius.large,
    backgroundColor: Palette.goSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHint: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: Spacing.three,
    minHeight: 32,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.66)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  swipeHintText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },

  missionProgress: {
    marginTop: Spacing.threeHalf,
    gap: Spacing.two,
  },
  missionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  missionKicker: {
    ...Kicker,
    color: Palette.go,
  },
  missionValue: {
    ...Stat,
    fontSize: 30,
    lineHeight: 36,
    color: Palette.ink,
  },
  missionDetail: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  steps: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.goSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  stepTitle: {
    ...Typography.body,
    fontSize: 17,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  stepText: {
    ...Typography.caption,
    fontSize: 15,
    lineHeight: 20,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },

  radarWrap: {
    marginTop: Spacing.one,
    alignItems: 'center',
  },
  radar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(232, 85, 43, 0.28)',
    backgroundColor: 'rgba(232, 85, 43, 0.05)',
  },
  radarPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Palette.goBright,
  },
  radarPin: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Palette.go,
    borderWidth: 4,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  radarThumb: {
    position: 'absolute',
    borderRadius: Radius.medium,
    borderWidth: 3,
    borderColor: Palette.white,
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
    ...Shadow.card,
  },
  privacy: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  privacyText: {
    ...Typography.caption,
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },

  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.twoHalf,
    gap: Spacing.twoHalf,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.line,
  },
  dotActive: {
    width: 24,
    backgroundColor: Palette.goBright,
  },
  secondary: {
    minHeight: HitSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...Typography.body,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
});
