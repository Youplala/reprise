import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useStations } from '@/providers/stations-provider';
import { trySetLocationPreference } from '@/services/location-preference';
import { completeOnboarding, LOCATION_PRIVACY_COPY } from '@/services/onboarding';
import type { StationDetail } from '@/types/station';

const PAGES = ['mission', 'demo', 'location'] as const;
type Page = (typeof PAGES)[number];

const ORANGE = Palette.copper;

type OnboardingScreenProps = {
  onComplete: () => void;
};

function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

// La photo porte l'écran ; le titre n'est plus qu'une légende posée sur le fond, sans
// paragraphe qui reformulerait ce que l'image montre déjà (voir direction-visuelle.md).
function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={styles.heading}>{title}</Text>
    </View>
  );
}

function PhotoCaption({ name }: { name: string }) {
  return (
    <Text numberOfLines={1} style={styles.photoCaption}>
      {name}
    </Text>
  );
}

function Hero({
  pair,
  height,
  playIntro,
  onInteractionChange,
}: {
  pair?: StationDetail;
  height: number;
  playIntro?: boolean;
  onInteractionChange?: (active: boolean) => void;
}) {
  if (!pair?.referenceImage || !pair.recaptureImage) {
    return (
      <View style={[styles.heroFallback, { height }]}>
        <SymbolView name="photo.on.rectangle.angled" size={32} tintColor={Palette.parisBlue} />
        <Text style={styles.heroFallbackText}>Un avant / après parisien</Text>
      </View>
    );
  }

  return (
    <BeforeAfterSlider
      before={pair.referenceImage}
      after={pair.recaptureImage}
      beforeLabel={String(pair.year)}
      afterLabel="2026"
      borderRadius={0}
      height={height}
      playIntro={playIntro}
      onInteractionChange={onInteractionChange}
      style={styles.heroFlat}
    />
  );
}

function LocationHero({ pair, height }: { pair?: StationDetail; height: number }) {
  if (!pair?.referenceImage) {
    return (
      <View style={[styles.heroFallback, { height }]}>
        <SymbolView name="location.fill" size={30} tintColor={Palette.copper} />
        <Text style={styles.heroFallbackText}>Une photo vous attend près d’ici.</Text>
      </View>
    );
  }

  return (
    <Image
      source={pair.referenceImage}
      style={[styles.locationHero, { height }]}
      contentFit="cover"
    />
  );
}

function ProcessStep({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <View style={styles.processStep}>
      <Text style={styles.processNumber}>{number}</Text>
      <View style={styles.processRule} />
      <Text style={styles.processTitle}>{title}</Text>
      <Text style={styles.processCopy}>{copy}</Text>
    </View>
  );
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { width, height } = useWindowDimensions();
  const { publishedSubmissions } = useStations();
  const { locate, loading: locating } = useUserLocation();
  const listRef = useRef<FlatList<Page>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);
  const [finishing, setFinishing] = useState(false);
  // Sans paragraphe d'intro ni carte de pictogrammes, l'image peut grandir et occuper le
  // haut de l'écran : c'est elle qui porte la page, le texte n'en est que la légende.
  const heroHeight = Math.min(440, Math.max(280, height * 0.46));
  // La première étape ne porte qu'un titre sous l'image : à hauteur commune, il restait un vide
  // en bas d'écran. L'image le prend, puisque c'est elle qu'on est venu voir.
  const heroHeightAlone = Math.min(470, Math.max(300, height * 0.5));
  // La dernière étape porte le plus de contenu — titre, mention de confidentialité, échappatoire.
  // L'image lui cède la place : une information sur la vie privée ne doit pas demander à défiler.
  const heroHeightShort = Math.min(320, Math.max(200, height * 0.34));

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

  const goToLocationChoice = () => {
    void Haptics.selectionAsync();
    const locationIndex = PAGES.length - 1;
    listRef.current?.scrollToIndex({ index: locationIndex, animated: true });
    setPageIndex(locationIndex);
  };

  const goNext = () => {
    if (pageIndex === PAGES.length - 1) {
      void findFirstPhoto();
      return;
    }
    void Haptics.selectionAsync();
    const nextIndex = pageIndex + 1;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setPageIndex(nextIndex);
  };

  const goPrevious = () => {
    if (pageIndex === 0) return;
    void Haptics.selectionAsync();
    const previousIndex = pageIndex - 1;
    listRef.current?.scrollToIndex({ index: previousIndex, animated: true });
    setPageIndex(previousIndex);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const renderPage = ({ item }: { item: Page }) => {
    const isActive = PAGES[pageIndex] === item;
    const accessibilityProps = {
      accessibilityElementsHidden: !isActive,
      importantForAccessibility: isActive ? ('auto' as const) : ('no-hide-descendants' as const),
    };

    if (item === 'mission') {
      const pair = publishedSubmissions[0];
      const caption = pair?.referenceImage && pair.recaptureImage ? pair : undefined;
      return (
        <ScrollView
          {...accessibilityProps}
          style={{ width }}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}>
          <Hero
            pair={pair}
            height={heroHeightAlone}
            onInteractionChange={(active) => setPagerScrollEnabled(!active)}
          />
          {caption ? <PhotoCaption name={caption.name} /> : null}
          <View style={styles.content}>
            <Heading
              eyebrow="BIENVENUE DANS PARIS GO"
              title={'Refaites les photos\ndu Paris de 1970.'}
            />
          </View>
        </ScrollView>
      );
    }

    if (item === 'demo') {
      const pair = publishedSubmissions[1] ?? publishedSubmissions[0];
      const caption = pair?.referenceImage && pair.recaptureImage ? pair : undefined;
      return (
        <ScrollView
          {...accessibilityProps}
          style={{ width }}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}>
          <Hero
            pair={pair}
            height={heroHeight}
            playIntro={isActive}
            onInteractionChange={(active) => setPagerScrollEnabled(!active)}
          />
          {caption ? <PhotoCaption name={caption.name} /> : null}
          {caption ? (
            <View style={styles.swipeHint}>
              <SymbolView name="arrow.left.and.right" size={13} tintColor={Palette.parisBlue} />
              <Text style={styles.swipeHintText}>GLISSEZ POUR COMPARER</Text>
            </View>
          ) : null}
          <View style={styles.content}>
            <Heading eyebrow="COMMENT ÇA MARCHE" title={'Trouver, reprendre,\ndéposer.'} />
            <View style={styles.processRow}>
              <ProcessStep number="01" title="TROUVER" copy="près de vous" />
              <ProcessStep number="02" title="REPRENDRE" copy="avec le guide" />
              <ProcessStep number="03" title="DÉPOSER" copy="sur le site officiel" />
            </View>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        {...accessibilityProps}
        style={{ width }}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}>
        <LocationHero pair={publishedSubmissions[0]} height={heroHeightShort} />
        <View style={styles.content}>
          <Heading eyebrow="AUTOUR DE VOUS" title={'La photo la plus\nproche de vous.'} />
          <View style={styles.privacyCard}>
            <View style={styles.privacyIcon}>
              <SymbolView name="lock.fill" size={16} tintColor={Palette.parisBlue} />
            </View>
            <View style={styles.privacyCopy}>
              <Text style={styles.privacyTitle}>VOTRE POSITION RESTE PRIVÉE</Text>
              <Text style={styles.privacyText}>{LOCATION_PRIVACY_COPY}</Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Explorer Paris sans utiliser ma position"
            accessibilityRole="button"
            onPress={() => void exploreWithoutLocation()}
            style={({ pressed }) => [styles.manualExploreButton, pressed && styles.pressed]}>
            <Text style={styles.manualExploreText}>EXPLORER SANS LOCALISATION</Text>
            <SymbolView name="map" size={15} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  const finalPage = pageIndex === PAGES.length - 1;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <StatusBar style="dark" animated />
      <View style={styles.header}>
        <Text style={styles.brand}>PARIS GO</Text>
        <View style={styles.headerRight}>
          <Text style={styles.pageCount}>
            0{pageIndex + 1} / 0{PAGES.length}
          </Text>
          {!finalPage ? (
            <Pressable
              accessibilityLabel="Passer au choix de localisation"
              accessibilityRole="button"
              hitSlop={10}
              onPress={goToLocationChoice}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
              <Text style={styles.skipText}>PASSER</Text>
            </Pressable>
          ) : null}
        </View>
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
          style={styles.progress}>
          {PAGES.map((page, index) => (
            <View key={page} style={[styles.progressTrack, index <= pageIndex && styles.progressDone]} />
          ))}
        </View>
        <View style={styles.footerActions}>
          {pageIndex > 0 ? (
            <Pressable
              accessibilityLabel="Revenir à l’étape précédente"
              accessibilityRole="button"
              onPress={goPrevious}
              style={({ pressed }) => [styles.backButton, pressed && styles.nextButtonPressed]}>
              <SymbolView
                name="chevron.left"
                size={14}
                tintColor={Palette.parisBlue}
              />
              <Text style={styles.backButtonText}>RETOUR</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={finalPage ? 'Voir les photos autour de moi' : 'Continuer'}
            accessibilityRole="button"
            disabled={finishing || locating}
            onPress={finalPage ? () => void findFirstPhoto() : goNext}
            style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.nextButtonText}>
              {finalPage ? 'VOIR AUTOUR DE MOI' : 'CONTINUER'}
            </Text>
            {finishing || locating ? (
              <ActivityIndicator color={Palette.white} size="small" />
            ) : (
              <SymbolView
                name={finalPage ? 'location.fill' : 'arrow.right'}
                size={18}
                tintColor={Palette.white}
              />
            )}
          </Pressable>
        </View>
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
    minHeight: 54,
    paddingHorizontal: Spacing.threeHalf,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.line,
  },
  brand: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '800',
    letterSpacing: 3,
  },
  headerRight: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pageCount: {
    ...Typography.caption,
    color: ORANGE,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skip: {
    minWidth: 54,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.55,
  },
  // Pas de padding horizontal ici : l'image doit toucher les bords de l'écran. Le texte
  // qui suit porte son propre padding via `content`.
  page: {
    flexGrow: 1,
    paddingBottom: Spacing.three,
  },
  eyebrow: {
    ...Typography.caption,
    color: ORANGE,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heading: {
    ...Typography.display,
    color: Palette.ink,
    fontFamily: Fonts.display,
    letterSpacing: -0.4,
    marginTop: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.threeHalf,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    gap: Spacing.five,
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Palette.blueMist,
  },
  heroFallbackText: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
  },
  // Neutralise l'ombre du composant : une photo à fond perdu ne flotte pas comme une carte.
  heroFlat: {
    shadowOpacity: 0,
    elevation: 0,
  },
  locationHero: {
    width: '100%',
    backgroundColor: Palette.archive,
  },
  photoCaption: {
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    paddingHorizontal: Spacing.threeHalf,
    marginTop: Spacing.two,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  swipeHintText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  processRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  processStep: {
    flex: 1,
  },
  processNumber: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontWeight: '800',
  },
  processRule: {
    height: 2,
    backgroundColor: Palette.parisBlue,
    marginVertical: Spacing.two,
  },
  processTitle: {
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  processCopy: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    marginTop: Spacing.half,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.twoHalf,
    borderRadius: Radius.medium,
    backgroundColor: Palette.blueMist,
    padding: Spacing.three,
  },
  privacyIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: Palette.white,
  },
  privacyCopy: {
    flex: 1,
  },
  privacyTitle: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  privacyText: {
    ...Typography.body,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    marginTop: Spacing.one,
  },
  manualExploreButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  manualExploreText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footer: {
    paddingHorizontal: Spacing.threeHalf,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: Spacing.twoHalf,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.line,
    backgroundColor: Palette.fog,
  },
  footerActions: {
    minHeight: 54,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  progress: {
    height: 3,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  progressTrack: {
    flex: 1,
    backgroundColor: Palette.line,
  },
  progressDone: {
    backgroundColor: ORANGE,
  },
  nextButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    paddingHorizontal: Spacing.threeHalf,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextButtonPressed: {
    opacity: 0.86,
  },
  nextButtonText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  backButton: {
    minWidth: 102,
    minHeight: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    borderRadius: Radius.pill,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  backButtonText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
