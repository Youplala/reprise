import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { AnimatedNumber } from '@/components/charts/animated-number';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useStations } from '@/providers/stations-provider';
import { trySetLocationPreference } from '@/services/location-preference';
import {
  completeOnboarding,
  HISTORIC_GRID_COUNT,
  LOCATION_PRIVACY_COPY,
} from '@/services/onboarding';
import type { StationDetail } from '@/types/station';
import type { CoverageCell } from '@/utils/mapping-coverage';

const PAGES = ['mission', 'archive', 'align', 'dates', 'location'] as const;
type Page = (typeof PAGES)[number];

const SOURCES = {
  observatoire: 'https://observatoire-photo.paris/',
  caue: 'https://www.caue75.fr/demarches-participatives/atlas-de-paysages/observatoire-photo',
  bhvp: 'https://bibliotheques-specialisees.paris.fr/',
} as const;

const PAPER = Palette.white;
const PAPER_MUTED = Palette.blueMist;
const NIGHT = Palette.blueDeep;
const ORANGE = Palette.copper;

const GRID_WIDTH = 760;
const GRID_HEIGHT = 390;
const GRID_PADDING = 20;

type OnboardingScreenProps = {
  onComplete: () => void;
};

function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

function EditorialHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <View>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.intro}>{copy}</Text>
    </View>
  );
}

function QuickFacts() {
  return (
    <View style={styles.quickFacts}>
      <View style={styles.quickFact}>
        <SymbolView name="iphone" size={16} tintColor={Palette.parisBlue} />
        <Text style={styles.quickFactText}>UN SMARTPHONE</Text>
      </View>
      <View style={styles.quickFactDivider} />
      <View style={styles.quickFact}>
        <SymbolView name="clock.fill" size={15} tintColor={Palette.parisBlue} />
        <Text style={styles.quickFactText}>ENV. 5 MIN</Text>
      </View>
      <View style={styles.quickFactDivider} />
      <View style={styles.quickFact}>
        <SymbolView name="person.2.fill" size={16} tintColor={Palette.parisBlue} />
        <Text style={styles.quickFactText}>OUVERT À TOUS</Text>
      </View>
    </View>
  );
}

function SourceLink({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}, ouvrir le site`}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.sourceLink, pressed && styles.sourceLinkPressed]}>
      <View style={styles.sourceLinkCopy}>
        <Text style={styles.sourceLinkTitle}>{title}</Text>
        <Text style={styles.sourceLinkDetail}>{detail}</Text>
      </View>
      <View style={styles.sourceLinkIcon}>
        <SymbolView name="arrow.up.right" size={14} tintColor={Palette.parisBlue} />
      </View>
    </Pressable>
  );
}

function LocationIllustration({ pair }: { pair?: StationDetail }) {
  if (!pair?.referenceImage) {
    return (
      <View style={styles.locationIllustrationFallback}>
        <SymbolView name="location.fill" size={34} tintColor={Palette.copper} />
        <Text style={styles.locationFallbackText}>Une photo vous attend près d’ici.</Text>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.locationIllustration}>
      <Image source={pair.referenceImage} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.locationPhotoShade} />
      <View style={styles.locationYearBadge}>
        <Text style={styles.locationYearText}>ARCHIVE · {pair.year}</Text>
      </View>
      <View style={styles.locationMissionCard}>
        <View style={styles.locationMissionPin}>
          <SymbolView name="location.fill" size={18} tintColor={Palette.white} />
        </View>
        <View style={styles.locationMissionCopy}>
          <Text style={styles.locationCaptionEyebrow}>EXEMPLE DE POINT DE VUE</Text>
          <Text numberOfLines={1} style={styles.locationCaptionTitle}>
            {pair.name}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PhotoCredit({ pair }: { pair: StationDetail }) {
  const archiveAuthor =
    pair.author === 'Photographe non identifié'
      ? 'photographe anonyme'
      : (pair.author ?? 'archive');

  return (
    <View style={styles.photoCreditRow}>
      <Text style={styles.photoLocation} numberOfLines={1}>
        {pair.name}
      </Text>
      <Text style={styles.photoCredit} numberOfLines={1}>
        ARCHIVE {pair.year} · {archiveAuthor} · VILLE DE PARIS / BHVP
      </Text>
      <Text style={styles.photoCredit} numberOfLines={1}>
        REPRISE 2026 · {pair.currentAuthor ?? 'contribution'} · OBSERVATOIRE / CAUE DE PARIS
      </Text>
    </View>
  );
}

function Comparison({
  pair,
  height,
  onInteractionChange,
}: {
  pair?: StationDetail;
  height: number;
  onInteractionChange?: (active: boolean) => void;
}) {
  if (!pair?.referenceImage || !pair.recaptureImage) {
    return (
      <View style={[styles.comparisonFallback, { height }]}>
        <SymbolView name="photo.on.rectangle.angled" size={34} tintColor={Palette.parisBlue} />
        <Text style={styles.comparisonFallbackText}>Un avant / après parisien</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.comparisonFrame}>
        <BeforeAfterSlider
          before={pair.referenceImage}
          after={pair.recaptureImage}
          beforeLabel={String(pair.year)}
          afterLabel="2026"
          borderRadius={Radius.large}
          height={height}
          onInteractionChange={onInteractionChange}
          style={styles.comparison}
        />
      </View>
      <PhotoCredit pair={pair} />
    </View>
  );
}

function TransparencyViewfinder({
  pair,
  height,
  onInteractionChange,
}: {
  pair?: StationDetail;
  height: number;
  onInteractionChange?: (active: boolean) => void;
}) {
  const [opacity, setOpacity] = useState(0.5);

  if (!pair?.referenceImage || !pair.recaptureImage) {
    return (
      <View style={[styles.comparisonFallback, { height }]}>
        <SymbolView name="camera.viewfinder" size={34} tintColor={Palette.parisBlue} />
        <Text style={styles.comparisonFallbackText}>Le guide transparent apparaîtra ici.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.opacityViewfinder, { height }]}>
        <Image
          source={pair.recaptureImage}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
        />
        <Image
          source={pair.referenceImage}
          style={[StyleSheet.absoluteFill, { opacity }]}
          contentFit="cover"
          transition={180}
        />

        <View pointerEvents="none" style={styles.viewfinderShade} />
        <View pointerEvents="none" style={[styles.guideLineVertical, { left: '33.33%' }]} />
        <View pointerEvents="none" style={[styles.guideLineVertical, { right: '33.33%' }]} />
        <View pointerEvents="none" style={[styles.guideLineHorizontal, { top: '33.33%' }]} />
        <View pointerEvents="none" style={[styles.guideLineHorizontal, { bottom: '33.33%' }]} />
        <View pointerEvents="none" style={styles.centerTarget}>
          <View style={styles.centerTargetDot} />
        </View>

        <View pointerEvents="none" style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>CAMÉRA · AUJOURD’HUI</Text>
        </View>
        <View pointerEvents="none" style={styles.archiveOverlayBadge}>
          <Text style={styles.archiveOverlayBadgeText}>ARCHIVE · {pair.year}</Text>
        </View>

        <View style={styles.opacityControl}>
          <SymbolView name="circle.lefthalf.filled" size={17} tintColor={PAPER} />
          <View style={styles.opacityControlBody}>
            <Text style={styles.opacityControlLabel}>TRANSPARENCE DE L’ARCHIVE</Text>
            <Slider
              accessibilityLabel="Opacité de la photo d’archive"
              accessibilityRole="adjustable"
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={opacity}
              onValueChange={setOpacity}
              onSlidingStart={() => onInteractionChange?.(true)}
              onSlidingComplete={() => {
                onInteractionChange?.(false);
                void Haptics.selectionAsync();
              }}
              minimumTrackTintColor={ORANGE}
              maximumTrackTintColor="rgba(244, 239, 229, 0.32)"
              thumbTintColor={PAPER}
              style={styles.opacitySlider}
            />
          </View>
          <Text style={styles.opacityPercent}>{Math.round(opacity * 100)}%</Text>
        </View>
      </View>
      <PhotoCredit pair={pair} />
    </View>
  );
}

function ArchiveGridMap({ cells }: { cells: CoverageCell[] }) {
  const illustration = useMemo(() => {
    if (!cells.length) return undefined;

    const west = Math.min(...cells.map((cell) => cell.bounds[0]));
    const south = Math.min(...cells.map((cell) => cell.bounds[1]));
    const east = Math.max(...cells.map((cell) => cell.bounds[2]));
    const north = Math.max(...cells.map((cell) => cell.bounds[3]));
    const longitudeRatio = Math.cos(((south + north) / 2) * (Math.PI / 180));
    const projectedWidth = (east - west) * longitudeRatio;
    const projectedHeight = north - south;
    const scale = Math.min(
      (GRID_WIDTH - GRID_PADDING * 2) / projectedWidth,
      (GRID_HEIGHT - GRID_PADDING * 2) / projectedHeight,
    );
    const drawingWidth = projectedWidth * scale;
    const drawingHeight = projectedHeight * scale;
    const offsetX = (GRID_WIDTH - drawingWidth) / 2;
    const offsetY = (GRID_HEIGHT - drawingHeight) / 2;
    const x = (longitude: number) =>
      offsetX + (longitude - west) * longitudeRatio * scale;
    const y = (latitude: number) => offsetY + (north - latitude) * scale;

    const squares = cells
      .map((cell) => {
        const [cellWest, cellSouth, cellEast, cellNorth] = cell.bounds;
        const fill = cell.published1970 ? Palette.lichen : Palette.blueMist;
        return `<rect x="${x(cellWest).toFixed(2)}" y="${y(cellNorth).toFixed(2)}" width="${Math.max(1, x(cellEast) - x(cellWest)).toFixed(2)}" height="${Math.max(1, y(cellSouth) - y(cellNorth)).toFixed(2)}" rx="0.8" fill="${fill}" stroke="${Palette.parisBlue}" stroke-width="0.8" />`;
      })
      .join('');

    const seine = [
      [2.228, 48.837],
      [2.265, 48.836],
      [2.296, 48.842],
      [2.315, 48.853],
      [2.338, 48.859],
      [2.361, 48.853],
      [2.385, 48.846],
      [2.416, 48.839],
      [2.462, 48.832],
    ]
      .map(([longitude, latitude], index) =>
        `${index ? 'L' : 'M'} ${x(longitude).toFixed(2)} ${y(latitude).toFixed(2)}`,
      )
      .join(' ');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID_WIDTH}" height="${GRID_HEIGHT}" viewBox="0 0 ${GRID_WIDTH} ${GRID_HEIGHT}"><g>${squares}</g><path d="${seine}" fill="none" stroke="${Palette.white}" stroke-opacity="0.88" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${seine}" fill="none" stroke="#91B7C7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="380" y="206" text-anchor="middle" fill="${Palette.parisBlue}" fill-opacity="0.78" font-family="system-ui" font-size="42" font-weight="800" letter-spacing="9">PARIS</text></svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [cells]);

  return (
    <View pointerEvents="none" style={styles.archiveMapFrame}>
      {illustration ? (
        <Image source={{ uri: illustration }} style={styles.archiveGridImage} contentFit="contain" />
      ) : null}
      <View style={styles.archiveMapTitle}>
        <Text style={styles.archiveMapTitleText}>PARIS · {HISTORIC_GRID_COUNT.toLocaleString('fr-FR')} CARRÉS</Text>
      </View>
      <View style={styles.archiveScale}>
        <Text style={styles.archiveScaleNumber}>250 M</Text>
        <Text style={styles.archiveScaleLabel}>PAR CARRÉ</Text>
      </View>
      <View style={styles.archiveLegend}>
        <View style={[styles.archiveLegendDot, styles.archiveLegendDotOpen]} />
        <Text style={styles.archiveLegendText}>À REPRENDRE</Text>
        <View style={[styles.archiveLegendDot, styles.archiveLegendDotDone]} />
        <Text style={styles.archiveLegendText}>OUVERT</Text>
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  label: string;
  decimals?: number;
  suffix?: string;
}) {
  return (
    <View style={styles.stat}>
      <AnimatedNumber
        value={value}
        decimals={decimals}
        suffix={suffix}
        duration={900}
        style={styles.statValue}
      />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

function ExhibitionRow({ venue, dates }: { venue: string; dates: string }) {
  return (
    <View style={styles.exhibitionRow}>
      <View>
        <Text style={styles.exhibitionLabel}>EXPOSITION</Text>
        <Text style={styles.exhibitionVenue}>{venue}</Text>
      </View>
      <Text style={styles.exhibitionDates}>{dates}</Text>
    </View>
  );
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { width, height } = useWindowDimensions();
  const { coverage, grid, publishedSubmissions } = useStations();
  const { locate, loading: locating } = useUserLocation();
  const listRef = useRef<FlatList<Page>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const comparisonHeight = Math.min(300, Math.max(228, height * 0.31));

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

  const openSource = async (url: string) => {
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error('unsupported');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Lien indisponible', 'Cette source ne peut pas être ouverte pour le moment.');
    }
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
      return (
        <ScrollView
          {...accessibilityProps}
          style={{ width }}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}>
          <EditorialHeading
            eyebrow="BIENVENUE DANS REPRISE"
            title={'Refaites les photos\ndu Paris de 1970.'}
            copy="En 1970, un grand concours a fait photographier tout Paris par des amateurs. Reprise vous emmène sur les lieux de ces photos et vous aide à reprendre la même vue aujourd’hui."
          />
          <QuickFacts />
          <Comparison
            pair={publishedSubmissions[0]}
            height={comparisonHeight}
            onInteractionChange={(active) => setPagerScrollEnabled(!active)}
          />
          <View style={styles.swipeNote}>
            <View style={styles.swipeLine} />
            <SymbolView name="arrow.left.and.right" size={15} tintColor={ORANGE} />
            <Text style={styles.swipeText}>GLISSEZ POUR TRAVERSER LE TEMPS</Text>
            <View style={styles.swipeLine} />
          </View>
        </ScrollView>
      );
    }

    if (item === 'archive') {
      return (
        <ScrollView
          {...accessibilityProps}
          style={{ width }}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}>
          <EditorialHeading
            eyebrow="LE CONCOURS HISTORIQUE · 1970"
            title={'Paris, cadré\n250 m par 250 m.'}
            copy="La Fnac et la Ville de Paris confient chaque carré de la capitale à des photographes amateurs. À votre tour : vos images deviendront une archive collective."
          />
          {isActive ? (
            <ArchiveGridMap cells={grid} />
          ) : (
            <View style={styles.archiveMapFrame} />
          )}
          <View style={styles.statsRow}>
            <Stat
              value={isActive ? coverage.published1970 : 0}
              label={'photos\nrefaites'}
            />
            <View style={styles.statDivider} />
            <Stat
              value={isActive ? coverage.squaresOpened : 0}
              label={'secteurs\nouverts'}
            />
            <View style={styles.statDivider} />
            <Stat
              value={isActive ? coverage.percentage : 0}
              decimals={1}
              suffix=" %"
              label={'du fonds\ndéjà repris'}
            />
          </View>
          <Text style={styles.sourceLine}>
            EN 1970 : 2 800 PHOTOGRAPHES · FONDS CONSERVÉ PAR LA BHVP
          </Text>
        </ScrollView>
      );
    }

    if (item === 'align') {
      return (
        <ScrollView
          {...accessibilityProps}
          style={{ width }}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}>
          <EditorialHeading
            eyebrow="À QUOI SERT REPRISE"
            title={'Trouver, cadrer,\npuis participer.'}
            copy="Reprise affiche l’archive en transparence par-dessus votre caméra : vous voyez les deux images en même temps et retrouvez l’angle exact sans tâtonner."
          />
          <TransparencyViewfinder
            pair={publishedSubmissions[1] ?? publishedSubmissions[0]}
            height={comparisonHeight}
            onInteractionChange={(active) => setPagerScrollEnabled(!active)}
          />
          <View style={styles.swipeNote}>
            <View style={styles.swipeLine} />
            <SymbolView name="arrow.left.and.right" size={15} tintColor={ORANGE} />
            <Text style={styles.swipeText}>GLISSEZ LE CURSEUR POUR DOSER</Text>
            <View style={styles.swipeLine} />
          </View>
          <View style={styles.processRow}>
            <ProcessStep number="01" title="TROUVER" copy="près de vous" />
            <ProcessStep number="02" title="REPRENDRE" copy="avec le guide" />
            <ProcessStep number="03" title="DÉPOSER" copy="sur le site officiel" />
          </View>
        </ScrollView>
      );
    }

    if (item === 'dates') {
      return (
        <ScrollView
          {...accessibilityProps}
          style={{ width }}
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}>
          <EditorialHeading
            eyebrow="CAMPAGNE 2026 · GRATUITE"
            title={'Ouverte à toutes\net à tous.'}
            copy="Merci d’y prendre part : chaque photo que vous déposez rejoint l’Observatoire et restera consultable bien après la campagne."
          />
          <View style={styles.compactDeadline}>
            <View>
              <Text style={[styles.deadlineLabel, styles.compactDeadlineLabel]}>
                PARTICIPEZ JUSQU’AU
              </Text>
              <Text style={styles.compactDeadlineDay}>30 NOV. 2026</Text>
            </View>
            <Text style={styles.compactDeadlineTime}>23 H 59</Text>
          </View>
          <View style={styles.exhibitions}>
            <Text style={styles.exhibitionsTitle}>EXPOSITIONS 2026</Text>
            <ExhibitionRow venue="CAUE · LA ROCHE" dates={'09.07 — 12.09'} />
            <ExhibitionRow venue="BHVP · PARIS 1970" dates={'01.06 — 07.10'} />
          </View>
          <View style={styles.sourcesSection}>
            <Text style={styles.sourcesTitle}>SOURCES OFFICIELLES</Text>
            <SourceLink
              title="OBSERVATOIRE PHOTO"
              detail="Voir la campagne et les contributions"
              onPress={() => void openSource(SOURCES.observatoire)}
            />
            <SourceLink
              title="CAUE DE PARIS"
              detail="Comprendre la démarche participative"
              onPress={() => void openSource(SOURCES.caue)}
            />
            <SourceLink
              title="ARCHIVES BHVP"
              detail="Consulter le fonds C’était Paris en 1970"
              onPress={() => void openSource(SOURCES.bhvp)}
            />
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        {...accessibilityProps}
        style={{ width }}
        contentContainerStyle={[styles.page, styles.locationPage]}
        showsVerticalScrollIndicator={false}>
        <EditorialHeading
          eyebrow="AUTOUR DE VOUS"
          title={'Commencez par\nla photo la plus proche.'}
          copy="Autorisez la localisation : Reprise vous montre aussitôt le point de vue le plus proche."
        />
        <LocationIllustration pair={publishedSubmissions[0]} />
        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <SymbolView name="lock.fill" size={16} tintColor={Palette.parisBlue} />
          </View>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>VOTRE POSITION RESTE PRIVÉE</Text>
            <Text style={styles.privacyText}>
              {LOCATION_PRIVACY_COPY}
            </Text>
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
      </ScrollView>
    );
  };

  const finalPage = pageIndex === PAGES.length - 1;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <StatusBar style="dark" animated />
      <View style={styles.header}>
        <Text style={styles.brand}>REPRISE</Text>
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
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  headerRight: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pageCount: {
    color: ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  skip: {
    minWidth: 54,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pressed: {
    opacity: 0.55,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: Spacing.threeHalf,
    paddingTop: Spacing.threeHalf,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  eyebrow: {
    color: ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  heading: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 40,
    marginTop: Spacing.two,
    paddingTop: 3,
  },
  intro: {
    maxWidth: 540,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.twoHalf,
  },
  quickFacts: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: Radius.medium,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  quickFact: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 3,
  },
  quickFactDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
    backgroundColor: Palette.line,
  },
  quickFactText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  comparisonFrame: {
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    padding: 4,
    ...Shadow.card,
  },
  comparison: {
    shadowOpacity: 0,
    elevation: 0,
  },
  comparisonFallback: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  comparisonFallbackText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 10,
  },
  photoCreditRow: {
    marginTop: Spacing.two,
    gap: 2,
  },
  photoLocation: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  photoCredit: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 7,
    letterSpacing: 0.15,
  },
  swipeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swipeLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.line,
  },
  swipeText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  archiveMapFrame: {
    height: 224,
    overflow: 'hidden',
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  archiveGridImage: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 22,
    bottom: 12,
  },
  archiveMapTitle: {
    position: 'absolute',
    top: 9,
    left: 9,
    backgroundColor: NIGHT,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  archiveMapTitleText: {
    color: PAPER,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  archiveScale: {
    position: 'absolute',
    left: 9,
    bottom: 9,
    backgroundColor: ORANGE,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  archiveScaleNumber: {
    color: PAPER,
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16,
  },
  archiveScaleLabel: {
    color: PAPER,
    fontFamily: Fonts.mono,
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  archiveLegend: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  archiveLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  archiveLegendDotOpen: {
    backgroundColor: Palette.blueMist,
  },
  archiveLegendDotDone: {
    backgroundColor: Palette.lichen,
  },
  archiveLegendText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 5.5,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  statsRow: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: Radius.medium,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.twoHalf,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
    backgroundColor: Palette.line,
  },
  statValue: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  statLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sourceLine: {
    color: ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    lineHeight: 13,
    letterSpacing: 0.65,
  },
  sourcesSection: {
    gap: Spacing.two,
  },
  sourcesTitle: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  sourceLink: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.medium,
    backgroundColor: Palette.white,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    ...Shadow.card,
  },
  sourceLinkPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  sourceLinkCopy: {
    flex: 1,
  },
  sourceLinkTitle: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  sourceLinkDetail: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    marginTop: 2,
  },
  sourceLinkIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: Palette.fog,
  },
  opacityViewfinder: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.large,
    borderWidth: 4,
    borderColor: Palette.white,
    backgroundColor: Palette.archive,
    ...Shadow.card,
  },
  viewfinderShade: {
    ...StyleSheet.absoluteFill,
    borderWidth: 6,
    borderColor: 'rgba(9, 40, 58, 0.24)',
  },
  guideLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(244, 239, 229, 0.4)',
  },
  guideLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(244, 239, 229, 0.4)',
  },
  centerTarget: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 229, 0.82)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTargetDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ORANGE,
  },
  liveBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(9, 40, 58, 0.84)',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Palette.lichen,
  },
  liveText: {
    color: PAPER,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  archiveOverlayBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: ORANGE,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  archiveOverlayBadgeText: {
    color: PAPER,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  opacityControl: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(9, 40, 58, 0.9)',
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
  },
  opacityControlBody: {
    flex: 1,
  },
  opacityControlLabel: {
    color: PAPER_MUTED,
    fontFamily: Fonts.mono,
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.55,
    marginLeft: 2,
  },
  opacitySlider: {
    width: '100%',
    height: 24,
    marginTop: -1,
  },
  opacityPercent: {
    minWidth: 34,
    color: PAPER,
    fontFamily: Fonts.display,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  processRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  processStep: {
    flex: 1,
  },
  processNumber: {
    color: ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  processRule: {
    height: 2,
    backgroundColor: Palette.parisBlue,
    marginVertical: Spacing.two,
  },
  processTitle: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  processCopy: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    marginTop: 2,
  },
  compactDeadline: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderRadius: Radius.medium,
    backgroundColor: Palette.parisBlue,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
    ...Shadow.card,
  },
  compactDeadlineDay: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.7,
    paddingTop: 2,
  },
  compactDeadlineLabel: {
    color: Palette.blueMist,
  },
  compactDeadlineTime: {
    color: Palette.blueMist,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    paddingBottom: 5,
  },
  locationPage: {
    justifyContent: 'flex-start',
  },
  locationIllustration: {
    position: 'relative',
    height: 238,
    overflow: 'hidden',
    borderRadius: Radius.large,
    backgroundColor: Palette.archive,
    ...Shadow.card,
  },
  locationIllustrationFallback: {
    height: 238,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  locationFallbackText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  locationPhotoShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 40, 58, 0.2)',
  },
  locationYearBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    borderRadius: Radius.pill,
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  locationYearText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  locationMissionCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 10,
  },
  locationMissionPin: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: Palette.copper,
  },
  locationMissionCopy: {
    flex: 1,
  },
  locationCaptionEyebrow: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  locationCaptionTitle: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
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
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  privacyText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  manualExploreButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  manualExploreText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  posterPage: {
    flexGrow: 1,
    paddingHorizontal: Spacing.threeHalf,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  posterLead: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 41,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginTop: Spacing.two,
    paddingTop: 3,
  },
  deadlineBlock: {
    marginTop: -4,
  },
  deadlineLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  deadlineDay: {
    color: ORANGE,
    fontFamily: Fonts.display,
    fontSize: 76,
    lineHeight: 90,
    fontWeight: '900',
    letterSpacing: -2.8,
    paddingTop: 3,
  },
  deadlineYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  deadlineRule: {
    flex: 1,
    height: 3,
    backgroundColor: Palette.parisBlue,
  },
  deadlineYear: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  photoStrip: {
    height: 106,
    flexDirection: 'row',
    gap: 3,
    overflow: 'hidden',
    borderRadius: Radius.medium,
  },
  stripImage: {
    flex: 1,
    height: '100%',
  },
  stripWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 40, 58, 0.18)',
  },
  stripCaption: {
    position: 'absolute',
    left: 8,
    bottom: 7,
    color: PAPER,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  exhibitions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.line,
  },
  exhibitionsTitle: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
    paddingVertical: Spacing.two,
  },
  exhibitionRow: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.line,
    gap: Spacing.two,
  },
  exhibitionLabel: {
    color: ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  exhibitionVenue: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
  exhibitionDates: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.35,
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
    gap: 4,
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
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
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
    gap: 6,
  },
  backButtonText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});
