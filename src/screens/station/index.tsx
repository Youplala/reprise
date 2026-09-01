import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Polygon, UrlTile } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { ArchiveFilmstrip } from '@/components/archive-filmstrip';
import { BeforeAfterSlider } from '@/components/before-after-slider';
import { GlassSurface } from '@/components/glass-surface';
import { PhotoViewer } from '@/components/photo-viewer';
import { PrimaryButton } from '@/components/primary-button';
import { SourcePill } from '@/components/source-pill';
import {
  TimeTravelSlider,
  type TimelineYear,
} from '@/components/time-travel-slider';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { PROJECT_LABEL, PROJECT_URL } from '@/constants/legal';
import { PARIS_CENTER } from '@/data/archive';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import { buildPhotoReportDraft, launchPhotoReport } from '@/utils/photo-report';

const BHVP_NAME = 'Bibliothèque historique de la Ville de Paris';
const PARIS_1970_FUND = 'Fonds « C’était Paris en 1970 »';

function formatContributionDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function MetadataInlineItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadataInlineItem}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function StationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, summary, loading } = useStationDetail(id);
  const heroPagerRef = useRef<FlatList<ImageSource>>(null);
  const shareCardRef = useRef<View>(null);
  const archiveCount = detail?.archiveLinks.length || summary?.frameCount || 0;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [timelineSelection, setTimelineSelection] = useState<TimelineYear>();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [comparisonActive, setComparisonActive] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [shareMenuVisible, setShareMenuVisible] = useState(false);
  const isArchive = (detail?.kind ?? summary?.kind) === 'archive-1970';
  const remainingArchiveCount =
    detail?.remainingCount ?? summary?.remainingCount ?? archiveCount;
  const publishedArchiveCount =
    detail?.publishedCount ?? summary?.publishedCount ?? 0;
  const { images: archiveImages, loading: archiveImagesLoading } = useBhvpImages(
    isArchive ? detail?.archiveLinks : undefined,
  );

  const images =
    archiveImages.length > 0
      ? archiveImages
      : detail?.images ?? (summary?.previewImage ? [summary.previewImage] : []);
  const selectedImage = (images[selectedIndex] ?? images[0]) as ImageSource | undefined;
  const selectedArchiveMetadata = isArchive
    ? detail?.archiveMetadata[selectedIndex]
    : detail?.referenceMetadata;
  // Un carré de 1970 couvre une maille de 250 m : on trace son emprise réelle plutôt qu'un point.
  const squareBounds = detail?.bounds ?? summary?.bounds;
  const referenceYear = detail?.year ?? summary?.year ?? 1970;
  const title = detail?.name ?? summary?.name ?? 'Point de vue';
  const referenceAuthor = (selectedArchiveMetadata?.author ?? detail?.author)?.trim();
  const referenceLocations = selectedArchiveMetadata?.locations ?? [];
  const archiveCandidateNumber = selectedArchiveMetadata?.candidateNumber;
  const currentAuthor = detail?.currentAuthor?.trim();
  const currentDescription = detail?.description?.trim();
  const currentDate = formatContributionDate(detail?.recaptureDate);
  const referenceImage = detail?.referenceImage;
  const recaptureImage = detail?.recaptureImage;
  const hasComparison = Boolean(detail?.hasRecapture && referenceImage && recaptureImage);
  const hasHistoricalNotice = Boolean(
    referenceAuthor || referenceLocations.length || archiveCandidateNumber,
  );
  const hasCurrentNotice = Boolean(
    hasComparison &&
      (currentAuthor || currentDescription || currentDate || detail?.currentDevice),
  );
  const referenceCreditTitle = `${referenceYear} · ${referenceAuthor ?? 'Auteur non renseigné'}`;
  const referenceCreditSource =
    referenceYear === 1970
      ? `${BHVP_NAME} · ${PARIS_1970_FUND}`
      : 'Observatoire photo participatif des paysages parisiens · CAUE de Paris';
  const currentCredit = `Photo 2026 · ${currentAuthor ?? 'Contributeur·rice non renseigné·e'}`;
  const selectedViewNumber = String(selectedIndex + 1).padStart(2, '0');
  const coordinate = detail?.coordinate ?? summary?.coordinate ?? PARIS_CENTER;
  const recaptureIndex =
    recaptureImage && images.length > 1 ? images.length - 1 : undefined;
  const availableYears = useMemo<TimelineYear[]>(() => {
    const years: TimelineYear[] = [referenceYear];
    if (recaptureIndex !== undefined) years.push(2026);
    return years;
  }, [recaptureIndex, referenceYear]);
  const activeYear = timelineSelection ?? referenceYear;
  const shareUrl = PROJECT_URL;

  const yearForFrame = (index: number): TimelineYear =>
    recaptureIndex !== undefined && index === recaptureIndex ? 2026 : referenceYear;

  const selectFrame = (index: number, animated = true) => {
    const nextIndex = Math.max(0, Math.min(images.length - 1, index));
    setSelectedIndex(nextIndex);
    setTimelineSelection(yearForFrame(nextIndex));
    heroPagerRef.current?.scrollToIndex({ index: nextIndex, animated });
  };

  const selectYear = (year: TimelineYear) => {
    setTimelineSelection(year);
    const frameIndex =
      year === referenceYear ? 0 : year === 2026 ? recaptureIndex : undefined;
    if (frameIndex !== undefined) {
      setSelectedIndex(frameIndex);
      heroPagerRef.current?.scrollToIndex({ index: frameIndex, animated: true });
    }
  };

  const region = useMemo(
    () => ({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: detail?.approximate ? 0.006 : 0.003,
      longitudeDelta: detail?.approximate ? 0.005 : 0.0024,
    }),
    [coordinate.latitude, coordinate.longitude, detail?.approximate],
  );

  if (loading && !summary) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={Palette.parisBlue} />
        <Text style={styles.loadingText}>Ouverture de la photo…</Text>
      </View>
    );
  }

  const openOfficial = async () => {
    const url = isArchive
      ? detail?.archiveLinks[selectedIndex] ?? detail?.officialUrl
      : detail?.officialUrl;
    const sourceUrl = url ?? 'https://observatoire-photo.paris/map';
    try {
      const supported = await Linking.canOpenURL(sourceUrl);
      if (!supported) {
        Alert.alert(
          'Source indisponible',
          'La page officielle ne peut pas être ouverte sur cet appareil.',
        );
        return;
      }
      await Linking.openURL(sourceUrl);
    } catch {
      Alert.alert(
        'Source indisponible',
        'La page officielle est momentanément inaccessible. Réessayez plus tard.',
      );
    }
  };

  const openAlignment = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/align/[id]',
      params: { id: id ?? '', frame: String(selectedIndex) },
    });
  };

  const openOnMap = () => {
    void Haptics.selectionAsync();
    router.push({
      pathname: '/map',
      params: {
        station: id ?? '',
        focus: String(Date.now()),
      },
    });
  };

  const reportRecapture = () => {
    const draft = buildPhotoReportDraft({
      title,
      stationId: id,
      officialUrl: detail?.officialUrl,
    });

    Alert.alert(
      'Signaler cette photo',
      'Un brouillon d’email va être préparé pour l’équipe de l’Observatoire. Vous pourrez décrire le problème avant de l’envoyer.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Préparer l’email',
          onPress: () => {
            void (async () => {
              const result = await launchPhotoReport(draft.mailto, Linking);
              if (result === 'opened') return;

              Alert.alert(
                'Email indisponible',
                draft.fallbackMessage,
                [
                  { text: 'Fermer', style: 'cancel' },
                  {
                    text: 'Partager les informations',
                    onPress: () => {
                      void Share.share({
                        title: draft.subject,
                        message: draft.fallbackMessage,
                      }).catch(() => {
                        Alert.alert('Partage indisponible', draft.fallbackMessage);
                      });
                    },
                  },
                ],
              );
            })();
          },
        },
      ],
    );
  };

  const shareComparisonCard = async () => {
    if (!shareCardRef.current || sharingCard) return;
    setSharingCard(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await Share.share({
          title: `Avant/après · ${title}`,
          message: `Découvrez « ${title} » avant et aujourd’hui dans Reprise.\n${referenceCreditTitle} · ${referenceCreditSource}\n${currentCredit}\n${shareUrl}`,
        });
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(uri, {
        dialogTitle: `Partager l’avant/après · ${title}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert(
        'Partage indisponible',
        'La carte avant/après n’a pas pu être préparée. Vous pouvez toujours partager son lien.',
      );
    } finally {
      setSharingCard(false);
    }
  };

  const shareRepriseLink = async () => {
    const message = `Découvrez « ${title} » en ${referenceYear} et aujourd’hui avec Reprise.\n${referenceCreditTitle} · ${referenceCreditSource}\n${currentCredit}`;
    void Haptics.selectionAsync();
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { title: `Avant/après · ${title}`, message, url: shareUrl }
          : { title: `Avant/après · ${title}`, message: `${message}\n${shareUrl}` },
      );
    } catch {
      Alert.alert('Partage indisponible', 'Le lien Reprise n’a pas pu être partagé.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        scrollEnabled={!comparisonActive}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {selectedImage ? (
            <FlatList
              ref={heroPagerRef}
              data={images}
              horizontal
              pagingEnabled
              bounces={false}
              decelerationRate="fast"
              disableIntervalMomentum
              getItemLayout={(_, index) => ({
                index,
                length: screenWidth,
                offset: screenWidth * index,
              })}
              initialScrollIndex={selectedIndex}
              keyExtractor={(_, index) => `hero-${index}`}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setSelectedIndex(index);
                setTimelineSelection(yearForFrame(index));
              }}
              onScrollToIndexFailed={({ index }) => {
                requestAnimationFrame(() => {
                  heroPagerRef.current?.scrollToOffset({
                    animated: false,
                    offset: index * screenWidth,
                  });
                });
              }}
              renderItem={({ item, index }) => (
                <Pressable
                  accessibilityLabel={`Agrandir la photo ${index + 1}`}
                  accessibilityRole="button"
                  onPress={() => setViewerVisible(true)}
                  style={[styles.heroPage, { width: screenWidth }]}>
                  <AdaptivePhoto
                    source={item}
                    style={StyleSheet.absoluteFill}
                    transition={220}
                  />
                  <View style={styles.heroShade} />
                </Pressable>
              )}
              showsHorizontalScrollIndicator={false}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <View style={styles.heroPlaceholderIcon}>
                <SymbolView name="photo.stack" size={30} tintColor={Palette.copper} />
              </View>
              <Text style={styles.heroPlaceholderTitle}>
                {archiveImagesLoading
                  ? 'Ouverture de la planche-contact…'
                  : `${archiveCount} ${archiveCount > 1 ? 'photos de 1970' : 'photo de 1970'}`}
              </Text>
              <Text style={styles.heroPlaceholderCopy}>
                {archiveImagesLoading
                  ? 'Les aperçus sont chargés depuis la Bibliothèque historique de la Ville de Paris.'
                  : 'Elles sont conservées par la Bibliothèque historique de la Ville de Paris. Ouvrez-les pour reconnaître le lieu, puis revenez ici.'}
              </Text>
            </View>
          )}
          <SafeAreaView edges={['top']} style={styles.heroControls}>
            <Pressable
              accessibilityLabel="Retour"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
              <SymbolView name="chevron.left" size={18} tintColor={Palette.ink} />
            </Pressable>
            <Pressable
              accessibilityLabel="Ouvrir la source de cette photo"
              onPress={openOfficial}
              style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed]}>
              <SymbolView name="info.circle" size={17} tintColor={Palette.ink} />
              <Text style={styles.sourceButtonText}>Source</Text>
            </Pressable>
          </SafeAreaView>
          <View style={styles.heroCaption}>
            <SourcePill label={detail?.sourceLabel ?? 'Observatoire de Paris'} inverse />
            <Pressable
              accessibilityLabel="Afficher la photo en plein écran"
              accessibilityRole="button"
              disabled={!selectedImage}
              onPress={() => setViewerVisible(true)}
              style={({ pressed }) => [styles.heroFrameButton, pressed && styles.pressed]}>
              <SymbolView name="magnifyingglass" size={13} tintColor={Palette.white} />
              <Text style={styles.heroFrame}>
                {images.length ? `${String(selectedIndex + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}` : 'SOURCE'}
              </Text>
            </Pressable>
          </View>
        </View>

        {availableYears.length > 1 ? (
          <TimeTravelSlider
            activeYear={activeYear}
            availableYears={availableYears}
            onSelect={selectYear}
          />
        ) : null}

        {images.length > 1 && !hasComparison ? (
          <View style={styles.filmstripWrap}>
            <ArchiveFilmstrip
              images={images}
              selectedIndex={selectedIndex}
              onSelect={selectFrame}
            />
          </View>
        ) : null}

        <View style={styles.content}>
          <Text style={styles.kicker}>
            {isArchive
              ? `ARCHIVE DE ${referenceYear}`
              : detail?.hasRecapture
                ? 'PHOTO REFAITE'
                : detail?.approximate ?? summary?.approximate
                  ? 'MISSION À LOCALISER'
                  : 'POINT DE VUE GÉOLOCALISÉ'}
          </Text>
          <Text style={styles.title}>
            {isArchive ? `Photo ${selectedViewNumber}` : title}
          </Text>

          {isArchive ? (
            <View style={styles.archiveCreditCard}>
              <Text style={styles.archiveCreditAuthor}>
                Auteur de la photographie · {referenceAuthor ?? 'non indiqué dans les données publiques'}
              </Text>
              <Text style={styles.archiveCreditSource}>
                {BHVP_NAME} · {PARIS_1970_FUND}
              </Text>
            </View>
          ) : null}

          {isArchive ? (
            <Pressable
              accessibilityLabel={`Voir le secteur ${title} sur la carte`}
              accessibilityRole="button"
              onPress={openOnMap}
              style={({ pressed }) => [
                styles.sectorLink,
                pressed && styles.sectorLinkPressed,
              ]}>
              <View style={styles.sectorLinkIcon}>
                <SymbolView
                  name="square.grid.3x3"
                  size={18}
                  tintColor={Palette.parisBlue}
                />
              </View>
              <View style={styles.sectorLinkCopy}>
                <Text style={styles.sectorLinkTitle}>Secteur {title} · zone de 250 m</Text>
                <Text style={styles.sectorLinkAction}>Voir le secteur sur la carte</Text>
              </View>
              <SymbolView name="chevron.right" size={14} tintColor={Palette.parisBlue} />
            </Pressable>
          ) : null}

          <Text style={styles.description}>
            {isArchive
              ? remainingArchiveCount === 0
                ? `Les ${archiveCount} ${archiveCount > 1 ? 'photos de ce secteur ont' : 'photo de ce secteur a'} déjà été refaites. Vous pouvez proposer un cadrage encore plus fidèle.`
                : `${remainingArchiveCount} ${remainingArchiveCount > 1 ? 'photos restent' : 'photo reste'} à retrouver dans ce secteur${publishedArchiveCount > 0 ? `, et ${publishedArchiveCount} ${publishedArchiveCount > 1 ? 'photos ont déjà été refaites' : 'photo a déjà été refaite'}` : ''}. Choisissez cette photo, puis retrouvez son point de vue sur place.`
              : hasComparison
                ? 'La photographie historique a été reprise depuis le même point de vue. Comparez les deux époques et découvrez les informations transmises avec chaque image.'
                : detail?.description ??
                (detail?.approximate ?? summary?.approximate
                  ? 'Le point de vue exact reste à retrouver dans cette zone.'
                  : 'Un point de vue de référence de l’Observatoire photo participatif des paysages parisiens.')}
          </Text>

          {hasHistoricalNotice || hasCurrentNotice ? (
            <View style={styles.storySection}>
              <Text style={styles.storySectionKicker}>HISTOIRE DES IMAGES</Text>
              <Text style={styles.storySectionTitle}>
                {hasCurrentNotice ? 'Deux regards, un même lieu' : 'Ce que raconte la notice'}
              </Text>

              {hasHistoricalNotice ? (
                <View style={[styles.storyCard, styles.storyCardArchive]}>
                  <View style={styles.storyCardHeader}>
                    <View style={styles.storyYearBadge}>
                      <Text style={styles.storyYearText}>1970</Text>
                    </View>
                    <Text style={styles.storyCardSource}>ARCHIVES BHVP</Text>
                  </View>
                  <Text style={styles.storyAuthor}>
                    {referenceAuthor ?? 'Photographe non identifié'}
                  </Text>
                  {referenceLocations.length ? (
                    <>
                      <Text style={styles.storyLabel}>LIEUX INDIQUÉS DANS LES LÉGENDES</Text>
                      <Text style={styles.storyText}>{referenceLocations.join(' · ')}</Text>
                      <Text style={styles.storyFinePrint}>
                        Lieux relevés par la BHVP dans les légendes du dossier du photographe ; ils peuvent concerner plusieurs vues de la série.
                      </Text>
                    </>
                  ) : null}
                  {selectedArchiveMetadata?.notes?.length ? (
                    <>
                      <Text style={styles.storyLabel}>NOTE DU CATALOGUE</Text>
                      <Text style={styles.storyText}>
                        {selectedArchiveMetadata.notes.join('\n')}
                      </Text>
                    </>
                  ) : null}
                  {selectedArchiveMetadata?.technique ||
                  selectedArchiveMetadata?.extent ||
                  selectedArchiveMetadata?.dimensions ? (
                    <View style={styles.storyFacts}>
                      {selectedArchiveMetadata?.technique ? (
                        <Text style={styles.storyFact}>{selectedArchiveMetadata?.technique}</Text>
                      ) : null}
                      {selectedArchiveMetadata?.extent ? (
                        <Text style={styles.storyFact}>{selectedArchiveMetadata?.extent}</Text>
                      ) : null}
                      {selectedArchiveMetadata?.dimensions ? (
                        <Text style={styles.storyFact}>{selectedArchiveMetadata?.dimensions}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  {archiveCandidateNumber ? (
                    <Text style={styles.storyReference}>
                      Candidat au concours n° {archiveCandidateNumber}
                    </Text>
                  ) : null}
                  {selectedArchiveMetadata?.callNumber ? (
                    <Text style={styles.storyReference}>
                      Cote BHVP · {selectedArchiveMetadata.callNumber}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {hasCurrentNotice ? (
                <View style={[styles.storyCard, styles.storyCardCurrent]}>
                  <View style={styles.storyCardHeader}>
                    <View style={[styles.storyYearBadge, styles.storyYearBadgeCurrent]}>
                      <Text style={[styles.storyYearText, styles.storyYearTextCurrent]}>2026</Text>
                    </View>
                    <Text style={styles.storyCardSource}>NOUVELLE CONTRIBUTION</Text>
                  </View>
                  <Text style={styles.storyAuthor}>
                    {currentAuthor ?? 'Contributeur·rice non renseigné·e'}
                  </Text>
                  {currentDescription ? (
                    <>
                      <Text style={styles.storyLabel}>OBSERVATION</Text>
                      <Text style={styles.storyText}>{currentDescription}</Text>
                    </>
                  ) : null}
                  <View style={styles.storyFacts}>
                    {currentDate ? <Text style={styles.storyFact}>{currentDate}</Text> : null}
                    {detail?.currentDevice ? (
                      <Text style={styles.storyFact}>{detail.currentDevice}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {hasComparison && referenceImage && recaptureImage ? (
            <View style={styles.recaptureBlock}>
              <View style={styles.recaptureCard}>
                <View style={styles.recaptureBody}>
                  <Text style={styles.recaptureKicker}>{referenceYear} → AUJOURD’HUI</Text>
                  <Text style={styles.recaptureTitle}>Même lieu, deux époques</Text>
                  <Text style={styles.recaptureHint}>
                    Faites glisser la poignée pour comparer les cadrages.
                  </Text>
                </View>
                <BeforeAfterSlider
                  before={referenceImage}
                  after={recaptureImage}
                  beforeLabel={String(detail?.year ?? referenceYear)}
                  afterLabel="2026"
                  borderRadius={0}
                  onInteractionChange={setComparisonActive}
                />
                <View style={styles.recaptureFooter}>
                  <View style={styles.recaptureCreditRow}>
                    <View style={styles.recaptureCreditIcon}>
                      <SymbolView name="camera.fill" size={13} tintColor={Palette.parisBlue} />
                    </View>
                    <View style={styles.recaptureCreditCopy}>
                      <Text style={styles.recaptureArchiveCredit} numberOfLines={1}>
                        {referenceCreditTitle.toLocaleUpperCase('fr-FR')}
                      </Text>
                      <Text style={styles.recaptureCredit} numberOfLines={2}>
                        {referenceCreditSource}
                      </Text>
                      <Text style={styles.recaptureCredit} numberOfLines={1}>
                        {currentCredit}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.repriseMark}>
                    <Text style={styles.repriseMarkName}>REPRISE</Text>
                    <Text style={styles.repriseMarkUrl}>{PROJECT_LABEL}</Text>
                  </View>
                </View>
              </View>

              <Pressable
                accessibilityLabel="Partager cet avant après"
                accessibilityRole="button"
                disabled={sharingCard}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setShareMenuVisible(true);
                }}
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.shareButtonPressed,
                ]}>
                {sharingCard ? (
                  <ActivityIndicator color={Palette.white} size="small" />
                ) : (
                  <SymbolView name="square.and.arrow.up" size={17} tintColor={Palette.white} />
                )}
                <Text style={styles.shareButtonText}>Partager</Text>
                <SymbolView name="chevron.right" size={13} tintColor={Palette.white} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={reportRecapture}
                style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                <SymbolView
                  name="exclamationmark.bubble"
                  size={14}
                  tintColor={Palette.copper}
                />
                <Text style={styles.reportText}>Signaler un problème avec cette photo</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.metadataStrip}>
            <MetadataInlineItem
              label="Date"
              value={detail?.dateLabel ?? String(detail?.year ?? summary?.year ?? 1970)}
            />
            <View style={styles.metadataDivider} />
            <MetadataInlineItem
              label="Paris"
              value={detail?.arrondissement ?? summary?.arrondissement ?? 'Paris'}
            />
            <View style={styles.metadataDivider} />
            <MetadataInlineItem
              label="Précision"
              value={detail?.approximate ?? summary?.approximate ? 'Secteur de 250 m' : 'Point exact'}
            />
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionKicker}>OÙ CHERCHER</Text>
              <Text style={styles.sectionTitle}>
                {detail?.approximate ?? summary?.approximate
                  ? 'Explorer ce secteur'
                  : 'Repérer ce point'}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityHint="Ouvre la carte complète centrée sur cette photo"
            accessibilityLabel="Ouvrir ce point sur la carte"
            accessibilityRole="button"
            onPress={openOnMap}
            style={({ pressed }) => [styles.mapWrap, pressed && styles.mapPressed]}>
            <MapView
              key={`${id}-${coordinate.latitude}-${coordinate.longitude}`}
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              mapType={Platform.OS === 'android' ? 'none' : 'standard'}
              loadingEnabled
              loadingBackgroundColor={Palette.blueMist}
              pitchEnabled={false}
              rotateEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
              pointerEvents="none">
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                shouldReplaceMapContent={Platform.OS === 'ios'}
                tileCacheMaxAge={604800}
              />
              {squareBounds ? (
                <Polygon
                  coordinates={[
                    { latitude: squareBounds[1], longitude: squareBounds[0] },
                    { latitude: squareBounds[3], longitude: squareBounds[0] },
                    { latitude: squareBounds[3], longitude: squareBounds[2] },
                    { latitude: squareBounds[1], longitude: squareBounds[2] },
                  ]}
                  strokeColor={Palette.copper}
                  fillColor="rgba(185, 95, 62, 0.18)"
                  strokeWidth={2}
                  lineDashPattern={[7, 5]}
                />
              ) : (
                <Circle
                  center={coordinate}
                  radius={detail?.approximate ? 125 : 24}
                  strokeColor={Palette.parisBlue}
                  fillColor="rgba(22, 63, 91, 0.16)"
                />
              )}
              <Marker coordinate={coordinate} pinColor={Palette.parisBlue} />
            </MapView>
            <View pointerEvents="none" style={styles.mapLegend}>
              <Text style={styles.mapLegendText}>
                {squareBounds
                  ? `SECTEUR ${detail?.name ?? summary?.name ?? ''} · ZONE APPROXIMATIVE`
                  : 'POSITION OBSERVATOIRE'}
              </Text>
            </View>
            <View pointerEvents="none" style={styles.mapAction}>
              <Text style={styles.mapActionText}>Ouvrir la carte</Text>
              <SymbolView name="arrow.up.right" size={11} tintColor={Palette.parisBlue} />
            </View>
            <View pointerEvents="none" style={styles.mapAttribution}>
              <Text style={styles.mapAttributionText}>© OPENSTREETMAP</Text>
            </View>
          </Pressable>

          <PrimaryButton
            label="Voir l’archive source"
            icon="arrow.up.right"
            variant="outline"
            onPress={openOfficial}
            style={styles.secondaryButton}
          />

          <Text style={styles.credit}>
            {squareBounds
              ? 'Photos de 1970 conservées par la Bibliothèque historique de la Ville de Paris, consultables sur le portail des bibliothèques spécialisées.'
              : detail?.sourceLabel ?? 'Observatoire photo participatif des paysages parisiens'}
          </Text>
        </View>
      </ScrollView>
      {hasComparison && referenceImage && recaptureImage ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.shareCaptureHost, { left: -screenWidth * 2, width: screenWidth - 32 }]}>
          <View ref={shareCardRef} collapsable={false} style={styles.shareExportCard}>
            <View style={styles.shareExportHeader}>
              <Text style={styles.shareExportKicker}>PARIS · AVANT / AUJOURD’HUI</Text>
              <Text style={styles.shareExportTitle}>{title}</Text>
            </View>
            <View style={styles.shareExportPhotos}>
              <View style={styles.shareExportPhoto}>
                <Image source={referenceImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={[styles.shareExportYear, styles.shareExportYearBefore]}>
                  <Text style={styles.shareExportYearText}>{referenceYear}</Text>
                </View>
              </View>
              <View style={styles.shareExportPhoto}>
                <Image source={recaptureImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={[styles.shareExportYear, styles.shareExportYearAfter]}>
                  <Text style={styles.shareExportYearText}>2026</Text>
                </View>
              </View>
              <View style={styles.shareExportDivider} />
            </View>
            <View style={styles.shareExportFooter}>
              <View style={styles.shareExportCredits}>
                <Text style={styles.recaptureArchiveCredit} numberOfLines={1}>
                  {referenceCreditTitle.toLocaleUpperCase('fr-FR')}
                </Text>
                <Text style={styles.recaptureCredit} numberOfLines={2}>
                  {referenceCreditSource}
                </Text>
                <Text style={styles.recaptureCredit} numberOfLines={1}>
                  {currentCredit}
                </Text>
              </View>
              <View style={styles.repriseMark}>
                <Text style={styles.repriseMarkName}>REPRISE</Text>
                <Text style={styles.repriseMarkUrl}>{PROJECT_LABEL}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
      {hasComparison && referenceImage && recaptureImage ? (
        <Modal
          animationType="fade"
          onRequestClose={() => setShareMenuVisible(false)}
          statusBarTranslucent
          transparent
          visible={shareMenuVisible}>
          <View style={styles.shareModalRoot}>
            <Pressable
              accessibilityLabel="Fermer les options de partage"
              onPress={() => setShareMenuVisible(false)}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView edges={['bottom']} style={styles.shareSheet}>
              <GlassSurface
                tintColor="rgba(248, 250, 249, 0.86)"
                variant="regular"
              />
              <View style={styles.shareSheetContent}>
                <View style={styles.shareSheetHandle} />
                <View style={styles.shareSheetHeader}>
                  <View style={styles.shareSheetHeading}>
                    <Text style={styles.shareSheetKicker}>PARTAGER</Text>
                    <Text style={styles.shareSheetTitle}>Cet avant/après</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Fermer"
                    onPress={() => setShareMenuVisible(false)}
                    style={({ pressed }) => [
                      styles.shareSheetClose,
                      pressed && styles.pressed,
                    ]}>
                    <SymbolView name="xmark" size={13} tintColor={Palette.ink} />
                  </Pressable>
                </View>

                <Pressable
                  accessibilityHint="Ouvre le menu de partage avec une image prête à publier"
                  accessibilityLabel="Partager la carte avant après"
                  accessibilityRole="button"
                  onPress={() => {
                    setShareMenuVisible(false);
                    setTimeout(() => void shareComparisonCard(), 220);
                  }}
                  style={({ pressed }) => [
                    styles.shareOption,
                    pressed && styles.shareOptionPressed,
                  ]}>
                  <View style={styles.shareOptionPreview}>
                    <Image source={referenceImage} style={styles.shareOptionPhoto} contentFit="cover" />
                    <Image source={recaptureImage} style={styles.shareOptionPhoto} contentFit="cover" />
                  </View>
                  <View style={styles.shareOptionCopy}>
                    <Text style={styles.shareOptionTitle}>La carte avant/après</Text>
                    <Text style={styles.shareOptionText}>
                      Deux images côte à côte, prêtes à publier.
                    </Text>
                  </View>
                  <SymbolView name="chevron.right" size={13} tintColor={Palette.inkSoft} />
                </Pressable>

                <Pressable
                  accessibilityHint="Partage un lien qui ouvre cette photo dans Reprise"
                  accessibilityLabel="Partager le lien Reprise"
                  accessibilityRole="button"
                  onPress={() => {
                    setShareMenuVisible(false);
                    setTimeout(() => void shareRepriseLink(), 220);
                  }}
                  style={({ pressed }) => [
                    styles.shareOption,
                    pressed && styles.shareOptionPressed,
                  ]}>
                  <View style={styles.shareOptionIcon}>
                    <SymbolView name="link" size={18} tintColor={Palette.parisBlue} />
                  </View>
                  <View style={styles.shareOptionCopy}>
                    <Text style={styles.shareOptionTitle}>Le lien Reprise</Text>
                    <Text style={styles.shareOptionText}>
                      Pour ouvrir directement cette photo dans l’app.
                    </Text>
                  </View>
                  <SymbolView name="chevron.right" size={13} tintColor={Palette.inkSoft} />
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
      {selectedImage && !viewerVisible ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.stickyActionDock,
            { bottom: Math.max(insets.bottom, 12) },
          ]}>
          <Pressable
            accessibilityHint="Ouvre le viseur avec cette image en superposition"
            accessibilityLabel={`Refaire la photo ${selectedIndex + 1}`}
            accessibilityRole="button"
            onPress={openAlignment}
            style={({ pressed }) => [
              styles.stickyAction,
              pressed && styles.stickyActionPressed,
            ]}>
            <SymbolView name="camera.fill" size={20} tintColor={Palette.white} />
            <Text style={styles.stickyActionText}>Refaire cette photo</Text>
            <SymbolView name="arrow.right" size={16} tintColor={Palette.white} />
          </Pressable>
        </View>
      ) : null}
      <PhotoViewer
        images={images}
        initialIndex={selectedIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        onIndexChange={(index) => selectFrame(index, false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  scrollContent: {
    paddingBottom: 144,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: Palette.fog,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  loadingText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  hero: {
    height: 440,
    backgroundColor: Palette.blueMist,
    overflow: 'hidden',
  },
  heroPage: {
    height: 440,
    backgroundColor: Palette.blueMist,
  },
  heroPlaceholder: {
    flex: 1,
    padding: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.blueMist,
  },
  heroPlaceholderIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(185, 95, 62, 0.14)',
  },
  heroPlaceholderTitle: {
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 26,
  },
  heroPlaceholderCopy: {
    marginTop: Spacing.two,
    maxWidth: 300,
    textAlign: 'center',
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  heroShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(8, 17, 22, 0.08)',
  },
  heroControls: {
    position: 'absolute',
    top: 0,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    marginTop: Spacing.one,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  sourceButton: {
    minWidth: 88,
    height: 44,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...Shadow.card,
  },
  sourceButtonText: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
  },
  heroCaption: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroFrame: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: Palette.black,
    textShadowRadius: 5,
  },
  heroFrameButton: {
    minHeight: 38,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(8, 17, 22, 0.68)',
  },
  filmstripWrap: {
    marginTop: -2,
    paddingVertical: Spacing.two,
    backgroundColor: Palette.black,
  },
  content: {
    padding: Spacing.three,
  },
  kicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: Spacing.two,
  },
  title: {
    marginTop: Spacing.two,
    marginHorizontal: -2,
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 4,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 47,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  archiveCreditCard: {
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(185, 95, 62, 0.24)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  archiveCreditAuthor: {
    color: Palette.ink,
    fontFamily: Fonts.mono,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  archiveCreditSource: {
    marginTop: 3,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
  },
  description: {
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  storySection: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  storySectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  storySectionTitle: {
    marginBottom: Spacing.one,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '800',
  },
  storyCard: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
  storyCardArchive: {
    borderColor: 'rgba(185, 95, 62, 0.3)',
    backgroundColor: 'rgba(255, 250, 245, 0.9)',
  },
  storyCardCurrent: {
    borderColor: 'rgba(119, 151, 138, 0.38)',
    backgroundColor: 'rgba(239, 246, 242, 0.92)',
  },
  storyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  storyYearBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Palette.copper,
  },
  storyYearBadgeCurrent: {
    backgroundColor: Palette.lichen,
  },
  storyYearText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  storyYearTextCurrent: {
    color: Palette.ink,
  },
  storyCardSource: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  storyAuthor: {
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 19,
    fontWeight: '800',
  },
  storyLabel: {
    marginTop: Spacing.twoHalf,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  storyText: {
    marginTop: 5,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  storyFinePrint: {
    marginTop: Spacing.one,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 15,
  },
  storyReference: {
    marginTop: Spacing.two,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '800',
  },
  storyFacts: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  storyFact: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '800',
  },
  sectorLink: {
    minHeight: 72,
    marginTop: Spacing.two,
    padding: Spacing.twoHalf,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  sectorLinkPressed: {
    backgroundColor: Palette.blueMist,
    transform: [{ scale: 0.99 }],
  },
  sectorLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.blueMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectorLinkCopy: {
    flex: 1,
  },
  sectorLinkTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '800',
  },
  sectorLinkAction: {
    marginTop: 3,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  metadataStrip: {
    marginTop: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    borderRadius: Radius.medium,
    backgroundColor: Palette.white,
  },
  metadataInlineItem: {
    flex: 1,
    minWidth: 0,
  },
  metadataDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    marginHorizontal: Spacing.two,
    backgroundColor: Palette.line,
  },
  metadataLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metadataValue: {
    marginTop: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  sectionHeading: {
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    marginTop: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '800',
  },
  mapWrap: {
    height: 230,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
  },
  mapPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  mapLegend: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapLegendText: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mapAction: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    minHeight: 32,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Shadow.card,
  },
  mapActionText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '900',
  },
  mapAttribution: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  mapAttributionText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 6,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  recaptureBlock: {
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },
  recaptureCard: {
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  recaptureBody: {
    padding: Spacing.three,
  },
  recaptureKicker: {
    color: Palette.lichen,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  recaptureTitle: {
    marginTop: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '800',
  },
  recaptureHint: {
    marginTop: 5,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  recaptureFooter: {
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  recaptureCreditRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recaptureCreditIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Palette.blueMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recaptureCredit: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
  },
  recaptureCreditCopy: {
    flex: 1,
  },
  recaptureArchiveCredit: {
    marginBottom: 2,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  repriseMark: {
    alignItems: 'flex-end',
  },
  repriseMarkName: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  repriseMarkUrl: {
    marginTop: -1,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  shareButton: {
    minHeight: 52,
    marginTop: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  shareButtonText: {
    flex: 1,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '900',
  },
  shareButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  shareCaptureHost: {
    position: 'absolute',
    top: 0,
  },
  shareModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    backgroundColor: 'rgba(8, 17, 22, 0.3)',
  },
  shareSheet: {
    overflow: 'hidden',
    borderRadius: Radius.large,
    backgroundColor: 'rgba(248, 250, 249, 0.84)',
    ...Shadow.card,
  },
  shareSheetContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  shareSheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginBottom: Spacing.twoHalf,
    borderRadius: 2,
    backgroundColor: 'rgba(22, 42, 54, 0.2)',
  },
  shareSheetHeader: {
    marginBottom: Spacing.twoHalf,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareSheetHeading: {
    flex: 1,
  },
  shareSheetKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  shareSheetTitle: {
    marginTop: 3,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
  },
  shareSheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareOption: {
    minHeight: 74,
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(38, 61, 75, 0.14)',
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(255,255,255,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  shareOptionPressed: {
    backgroundColor: 'rgba(224, 235, 238, 0.9)',
    transform: [{ scale: 0.99 }],
  },
  shareOptionPreview: {
    width: 62,
    height: 50,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: Palette.blueMist,
    flexDirection: 'row',
  },
  shareOptionPhoto: {
    flex: 1,
    height: 50,
  },
  shareOptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: Palette.blueMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareOptionCopy: {
    flex: 1,
  },
  shareOptionTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '900',
  },
  shareOptionText: {
    marginTop: 3,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  shareExportCard: {
    overflow: 'hidden',
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
  },
  shareExportHeader: {
    padding: Spacing.three,
    backgroundColor: Palette.white,
  },
  shareExportKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  shareExportTitle: {
    marginTop: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  shareExportPhotos: {
    height: 280,
    flexDirection: 'row',
  },
  shareExportPhoto: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
  },
  shareExportDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: Palette.white,
  },
  shareExportYear: {
    position: 'absolute',
    top: Spacing.two,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  shareExportYearBefore: {
    left: Spacing.two,
    backgroundColor: Palette.copper,
  },
  shareExportYearAfter: {
    right: Spacing.two,
    backgroundColor: Palette.parisBlue,
  },
  shareExportYearText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  shareExportFooter: {
    minHeight: 82,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    backgroundColor: Palette.white,
  },
  shareExportCredits: {
    flex: 1,
  },
  reportButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(185, 95, 62, 0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reportText: {
    color: Palette.copper,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: Spacing.two,
  },
  credit: {
    marginTop: Spacing.four,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  stickyActionDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(238, 244, 244, 0.97)',
  },
  stickyAction: {
    minHeight: 58,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    ...Shadow.card,
  },
  stickyActionPressed: {
    transform: [{ scale: 0.985 }],
    backgroundColor: Palette.blueDeep,
  },
  stickyActionText: {
    flex: 1,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
