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
import MapView, { Circle, Marker, Polygon } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { ArchiveFilmstrip } from '@/components/archive-filmstrip';
import { BeforeAfterSlider } from '@/components/before-after-slider';
import { ArchiveFacts, RecaptureFacts } from '@/components/photo-facts';
import { GlassActionDock } from '@/components/glass-action-dock';
import { ParisGoBadge } from '@/components/paris-go-badge';
import { GlassSurface } from '@/components/glass-surface';
import { PhotoViewer } from '@/components/photo-viewer';
import { PrimaryButton } from '@/components/primary-button';
import { SourcePill } from '@/components/source-pill';
import { Fonts, Kicker, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { PROJECT_URL } from '@/constants/legal';
import { PARIS_CENTER } from '@/data/archive';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import { archiveLinkForImage } from '@/services/bhvp-images';
import { historicalReferenceForFrame } from '@/services/camera-reference';
import { formatContributorName } from '@/utils/community-stats';
import { buildPhotoReportDraft, launchPhotoReport } from '@/utils/photo-report';

const BHVP_NAME = 'Bibliothèque historique de la Ville de Paris';
const PARIS_1970_FUND = 'Fonds « C’était Paris en 1970 »';

export function StationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Le comparateur ouvre l'écran : il prend plus de la moitié de la hauteur, quitte à recadrer
  // les deux photos à l'identique. Le plein écran, au toucher, les rend en entier.
  const comparisonHeight = Math.round(Math.min(560, Math.max(380, screenHeight * 0.56)));
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, summary, loading } = useStationDetail(id);
  const heroPagerRef = useRef<FlatList<ImageSource>>(null);
  const shareCardRef = useRef<View>(null);
  const archiveCount = detail?.archiveLinks.length || summary?.frameCount || 0;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [comparisonViewerVisible, setComparisonViewerVisible] = useState(false);
  const [comparisonViewerIndex, setComparisonViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [comparisonActive, setComparisonActive] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [shareMenuVisible, setShareMenuVisible] = useState(false);
  const isArchive = (detail?.kind ?? summary?.kind) === 'archive-1970';
  const { images: archiveImages, loading: archiveImagesLoading } = useBhvpImages(
    isArchive ? detail?.archiveLinks : undefined,
  );

  const images =
    archiveImages.length > 0
      ? archiveImages
      : detail?.images ?? (summary?.previewImage ? [summary.previewImage] : []);
  const selectedImage = (images[selectedIndex] ?? images[0]) as ImageSource | undefined;
  const selectedArchiveLink = archiveLinkForImage(selectedImage);
  const selectedArchiveIndex = selectedArchiveLink ? detail?.archiveLinks.indexOf(selectedArchiveLink) ?? -1 : -1;
  const selectedArchiveMetadata = isArchive
    ? detail?.archiveMetadata[selectedArchiveIndex]
    : detail?.referenceMetadata;
  const selectedRecaptures = (selectedArchiveLink && detail?.archiveRecaptures?.[selectedArchiveLink]) || [];
  const latestRecapture = selectedRecaptures[0];
  const frameRecaptureCounts = isArchive ? images.map(image => {
    const link = archiveLinkForImage(image);
    return link ? detail?.archiveRecaptures?.[link]?.length ?? 0 : 0;
  }) : undefined;
  // Un carré de 1970 couvre une maille de 250 m : on trace son emprise réelle plutôt qu'un point.
  const squareBounds = detail?.bounds ?? summary?.bounds;
  const referenceYear = detail?.year ?? summary?.year ?? 1970;
  const title = detail?.name ?? summary?.name ?? 'Point de vue';
  const referenceAuthor = (selectedArchiveMetadata?.author ?? detail?.author)?.trim();
  const referenceAuthorDisplay = referenceAuthor ? formatContributorName(referenceAuthor) : undefined;
  const currentAuthor = detail?.currentAuthor?.trim();
  const currentAuthorDisplay = currentAuthor ? formatContributorName(currentAuthor) : undefined;
  const currentDescription = detail?.description?.trim();
  const referenceImage = detail?.referenceImage;
  const recaptureImage = detail?.recaptureImage;
  const hasComparison = Boolean(detail?.hasRecapture && referenceImage && recaptureImage);
  const referenceCreditTitle = `${referenceYear} · ${referenceAuthorDisplay ?? 'Auteur non renseigné'}`;
  const referenceCreditSource =
    referenceYear === 1970
      ? `${BHVP_NAME} · ${PARIS_1970_FUND}`
      : 'Observatoire photo participatif des paysages parisiens · CAUE de Paris';
  const currentCredit = `Photo 2026 · ${currentAuthorDisplay ?? 'Contributeur·rice non renseigné·e'}`;
  const coordinate = detail?.coordinate ?? summary?.coordinate ?? PARIS_CENTER;
  const recaptureYearLabel = detail?.recaptureDate?.slice(0, 4) || 'Aujourd’hui';
  const shareUrl = PROJECT_URL;

  const selectFrame = (index: number, animated = true) => {
    const nextIndex = Math.max(0, Math.min(images.length - 1, index));
    setSelectedIndex(nextIndex);
    heroPagerRef.current?.scrollToIndex({ index: nextIndex, animated });
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
      ? selectedArchiveLink ?? detail?.officialUrl
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
    const historicalReference = historicalReferenceForFrame({
      images,
      recaptureImage: detail?.recaptureImage,
      referenceImage: detail?.referenceImage,
      requestedFrame: selectedIndex,
    });
    router.push({
      pathname: '/align/[id]',
      params: { id: id ?? '', frame: String(historicalReference.frameIndex) },
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
          message: `Découvrez « ${title} » avant et aujourd’hui dans Paris GO.\n${referenceCreditTitle} · ${referenceCreditSource}\n${currentCredit}\n${shareUrl}`,
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
    const message = `Découvrez « ${title} » en ${referenceYear} et aujourd’hui avec Paris GO.\n${referenceCreditTitle} · ${referenceCreditSource}\n${currentCredit}`;
    void Haptics.selectionAsync();
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { title: `Avant/après · ${title}`, message, url: shareUrl }
          : { title: `Avant/après · ${title}`, message: `${message}\n${shareUrl}` },
      );
    } catch {
      Alert.alert('Partage indisponible', 'Le lien Paris GO n’a pas pu être partagé.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        scrollEnabled={!comparisonActive}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {hasComparison && referenceImage && recaptureImage ? (
          // Une reprise n'a que deux photos : le comparateur tient lieu de galerie. Glisser
          // compare, toucher ouvre la photo touchée en plein écran.
          <View style={styles.comparisonHero}>
            <BeforeAfterSlider
              before={referenceImage}
              after={recaptureImage}
              beforeLabel={String(referenceYear)}
              afterLabel={recaptureYearLabel}
              height={comparisonHeight}
              borderRadius={0}
              labelsPosition="bottom"
              onInteractionChange={setComparisonActive}
              onPressSide={(side) => {
                void Haptics.selectionAsync();
                setComparisonViewerIndex(side === 'before' ? 0 : 1);
                setComparisonViewerVisible(true);
              }}
            />
            <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.heroControls}>
              <Pressable
                accessibilityLabel="Retour"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.circleButton, styles.floatingButton, pressed && styles.pressed]}>
                <SymbolView name="chevron.left" size={18} tintColor={Palette.ink} />
              </Pressable>
              <Pressable
                accessibilityLabel="Ouvrir la source de cette photo"
                onPress={openOfficial}
                style={({ pressed }) => [styles.sourceButton, styles.floatingButton, pressed && styles.pressed]}>
                <SymbolView name="info.circle" size={17} tintColor={Palette.ink} />
                <Text style={styles.sourceButtonText}>Source</Text>
              </Pressable>
            </SafeAreaView>
            <View style={styles.comparisonHint}>
              <SymbolView name="hand.draw" size={14} tintColor={Palette.inkSoft} />
              <Text style={styles.comparisonHintText}>
                Glissez pour comparer · touchez une photo pour l’agrandir
              </Text>
            </View>
          </View>
        ) : (
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
                    : 'Conservées par la Bibliothèque historique de la Ville de Paris. Ouvrez-les pour repérer le lieu.'}
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
              <SourcePill label={isArchive ? 'Archives BHVP · 1970' : detail?.sourceLabel ?? 'Observatoire de Paris'} inverse />
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
        )}


        {images.length > 1 && !hasComparison ? (
          <View style={styles.filmstripWrap}>
            {isArchive ? <Text style={styles.archiveProgress}>
              {detail?.publishedCount ?? 0} {detail?.publishedCount === 1 ? 'vue refaite identifiée' : 'vues refaites identifiées'} sur {archiveCount}
            </Text> : null}
            <ArchiveFilmstrip
              images={images}
              selectedIndex={selectedIndex}
              onSelect={selectFrame}
              recaptureCounts={frameRecaptureCounts}
            />
          </View>
        ) : null}

        <View style={styles.content}>
          {isArchive ? (
            <>
              <Text style={styles.kicker}>Secteur {title}</Text>
              <View style={styles.viewHead}>
                <Text style={[styles.title, styles.archiveTitle]}>
                  Vue {selectedIndex + 1} sur {images.length || archiveCount}
                </Text>
                {selectedImage ? (
                  <View style={[styles.statusChip, latestRecapture && styles.statusChipDone]}>
                    <SymbolView
                      name={latestRecapture ? 'checkmark.circle.fill' : 'scope'}
                      size={14}
                      tintColor={latestRecapture ? Palette.white : Palette.go}
                    />
                    <Text style={[styles.statusChipText, latestRecapture && styles.statusChipTextDone]}>
                      {latestRecapture ? 'Déjà refaite' : 'À retrouver'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {selectedImage && !latestRecapture ? (
                <Text style={styles.storyText}>
                  Personne ne l’a encore refaite. Les rues du reportage aident à repérer le lieu,
                  le viseur vous guidera pour le cadrage.
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.kicker}>
                {detail?.hasRecapture
                  ? 'PHOTO REFAITE'
                  : detail?.approximate ?? summary?.approximate
                    ? 'MISSION À LOCALISER'
                    : 'POINT DE VUE GÉOLOCALISÉ'}
              </Text>
              <Text style={styles.title}>{title}</Text>
            </>
          )}

          {!hasComparison && !isArchive ? (
            <Text style={styles.description}>
              {detail?.description ??
                  (detail?.approximate ?? summary?.approximate
                    ? 'Le point de vue exact reste à retrouver dans cette zone.'
                    : 'Un point de vue de référence de l’Observatoire photo participatif des paysages parisiens.')}
            </Text>
          ) : null}

          {hasComparison && referenceImage && recaptureImage ? (
            <View style={styles.recaptureBlock}>
              {detail ? <ParisGoBadge photo={detail} /> : null}


              <Pressable
                accessibilityRole="button"
                onPress={reportRecapture}
                style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                <SymbolView
                  name="exclamationmark.bubble"
                  size={14}
                  tintColor={Palette.inkSoft}
                />
                <Text style={styles.reportText}>Signaler un problème avec cette photo</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.facts}>
            {isArchive && selectedImage ? (
              <ArchiveFacts year={referenceYear} metadata={selectedArchiveMetadata} />
            ) : null}

            {isArchive && latestRecapture?.recaptureImage && selectedImage ? (
              <View style={styles.archiveRecaptures}>
                <BeforeAfterSlider
                  key={`${selectedArchiveLink}:${latestRecapture.id}`}
                  before={selectedImage}
                  after={latestRecapture.recaptureImage}
                  beforeLabel={String(referenceYear)}
                  afterLabel={latestRecapture.recaptureDate?.slice(0, 4) || 'Aujourd’hui'}
                  height={220}
                  borderRadius={Radius.large}
                  onInteractionChange={setComparisonActive}
                />
                <RecaptureFacts
                  referenceYear={referenceYear}
                  author={latestRecapture.currentAuthor}
                  date={latestRecapture.recaptureDate}
                  device={latestRecapture.currentDevice}
                  address={latestRecapture.address}
                  description={latestRecapture.description?.trim()}
                />
                {selectedRecaptures.map((recapture) => (
                  <Pressable
                    key={recapture.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Voir la reprise de ${recapture.currentAuthor ? formatContributorName(recapture.currentAuthor) : 'ce contributeur'}`}
                    onPress={() => router.push({ pathname: '/station/[id]', params: { id: recapture.id } })}
                    style={({ pressed }) => [styles.archiveRecaptureLink, pressed && styles.shareButtonPressed]}>
                    <Text style={styles.archiveRecaptureLinkText}>
                      Ouvrir la reprise de{' '}
                      {recapture.currentAuthor ? formatContributorName(recapture.currentAuthor) : 'ce contributeur'}
                    </Text>
                    <SymbolView name="arrow.right" size={15} tintColor={Palette.go} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {!isArchive && hasComparison ? (
              <>
                <RecaptureFacts
                  referenceYear={referenceYear}
                  author={currentAuthor}
                  date={detail?.recaptureDate}
                  device={detail?.currentDevice}
                  address={detail?.address}
                  description={currentDescription}
                />
                <ArchiveFacts
                  year={referenceYear}
                  metadata={detail?.referenceMetadata}
                  fallbackAuthor={detail?.author}
                />
              </>
            ) : null}
          </View>

          {/* Un seul kicker orange par écran (celui du haut) : cette tête de section se
              contente de son titre. */}
          <Text style={styles.sectionTitle}>
            {detail?.approximate ?? summary?.approximate
              ? 'Explorer ce secteur'
              : 'Repérer ce point'}
          </Text>

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
              mapType="mutedStandard"
              loadingEnabled
              loadingBackgroundColor={Palette.blueMist}
              pitchEnabled={false}
              rotateEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
              pointerEvents="none">
              {squareBounds ? (
                <Polygon
                  coordinates={[
                    { latitude: squareBounds[1], longitude: squareBounds[0] },
                    { latitude: squareBounds[3], longitude: squareBounds[0] },
                    { latitude: squareBounds[3], longitude: squareBounds[2] },
                    { latitude: squareBounds[1], longitude: squareBounds[2] },
                  ]}
                  strokeColor={Palette.copper}
                  fillColor="rgba(204, 72, 28, 0.18)"
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
                  ? 'ZONE APPROXIMATIVE'
                  : 'POSITION OBSERVATOIRE'}
              </Text>
            </View>
            <View pointerEvents="none" style={styles.mapAction}>
              <Text style={styles.mapActionText}>Ouvrir la carte</Text>
              <SymbolView name="arrow.up.right" size={11} tintColor={Palette.parisBlue} />
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
              <Text style={styles.parisGoSignature}>Paris GO</Text>
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
                tintColor="rgba(250, 247, 242, 0.86)"
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
                  accessibilityHint="Partage un lien qui ouvre cette photo dans Paris GO"
                  accessibilityLabel="Partager le lien Paris GO"
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
                    <Text style={styles.shareOptionTitle}>Le lien Paris GO</Text>
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
          <GlassActionDock
            primary={{
              label: isArchive && latestRecapture ? 'Refaire à mon tour' : 'Refaire cette photo',
              systemImage: 'camera.fill',
              accessibilityLabel: `Refaire la photo ${selectedIndex + 1}`,
              onPress: openAlignment,
            }}
            secondary={
              hasComparison
                ? {
                    label: 'Partager',
                    systemImage: 'square.and.arrow.up',
                    accessibilityLabel: 'Partager cet avant après',
                    loading: sharingCard,
                    onPress: () => {
                      void Haptics.selectionAsync();
                      setShareMenuVisible(true);
                    },
                  }
                : undefined
            }
          />
        </View>
      ) : null}
      {referenceImage && recaptureImage ? (
        <PhotoViewer
          images={[referenceImage, recaptureImage]}
          labels={[`${referenceYear} · ARCHIVE`, `${recaptureYearLabel} · REPRISE`]}
          initialIndex={comparisonViewerIndex}
          visible={comparisonViewerVisible}
          onClose={() => setComparisonViewerVisible(false)}
        />
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
  archiveProgress: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.white, marginHorizontal: Spacing.three, marginBottom: Spacing.two },
  archiveRecaptureLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  archiveRecaptureLinkText: { ...Typography.body, flex: 1, fontFamily: Fonts.sans, color: Palette.parisBlue },
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
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  hero: {
    height: 480,
    backgroundColor: Palette.blueMist,
    overflow: 'hidden',
  },
  comparisonHero: {
    backgroundColor: Palette.fog,
  },
  floatingButton: {
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  comparisonHint: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.twoHalf,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  comparisonHintText: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  heroPage: {
    height: 480,
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
    backgroundColor: 'rgba(204, 72, 28, 0.14)',
  },
  heroPlaceholderTitle: {
    ...Typography.body,
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroPlaceholderCopy: {
    ...Typography.caption,
    marginTop: Spacing.two,
    maxWidth: 300,
    textAlign: 'center',
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
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
    gap: Spacing.two,
    ...Shadow.card,
  },
  sourceButtonText: {
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
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
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '700',
    textShadowColor: Palette.black,
    textShadowRadius: 5,
  },
  heroFrameButton: {
    minHeight: 38,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
    ...Kicker,
    color: Palette.go,
    marginTop: Spacing.two,
  },
  title: {
    ...Typography.display,
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  archiveTitle: { marginTop: 0, flexShrink: 1 },
  viewHead: {
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusChip: {
    minHeight: 32,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: Palette.goSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statusChipDone: {
    backgroundColor: Palette.lichen,
  },
  statusChipText: {
    ...Typography.caption,
    color: Palette.go,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  statusChipTextDone: {
    color: Palette.white,
  },
  facts: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  archiveRecaptures: {
    gap: Spacing.three,
  },
  description: {
    ...Typography.body,
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  storyText: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  sectionTitle: {
    ...Typography.body,
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '700',
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
    top: Spacing.two,
    maxWidth: '90%',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapLegendText: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.display,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mapAction: {
    position: 'absolute',
    bottom: Spacing.five,
    right: Spacing.two,
    minHeight: 32,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    ...Shadow.card,
  },
  mapActionText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  recaptureBlock: {
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },
  parisGoSignature: {
    ...Typography.caption,
    fontFamily: Fonts.display,
    fontWeight: '900',
    color: Palette.parisBlue,
    alignSelf: 'flex-end',
  },
  recaptureCredit: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  recaptureArchiveCredit: {
    ...Typography.caption,
    marginBottom: Spacing.half,
    color: Palette.copper,
    fontFamily: Fonts.display,
    fontWeight: '700',
    letterSpacing: 0.35,
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
    backgroundColor: 'rgba(250, 247, 242, 0.86)',
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
    ...Typography.caption,
    color: Palette.copper,
    fontFamily: Fonts.display,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  shareSheetTitle: {
    ...Typography.body,
    marginTop: Spacing.half,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '700',
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
    borderRadius: Radius.small,
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
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  shareOptionText: {
    ...Typography.caption,
    marginTop: Spacing.half,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
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
    ...Typography.caption,
    color: Palette.copper,
    fontFamily: Fonts.display,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  shareExportTitle: {
    ...Typography.display,
    marginTop: Spacing.one,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '700',
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
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '700',
  },
  shareExportFooter: {
    minHeight: 82,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
    gap: Spacing.two,
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
    borderColor: Palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reportText: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: Spacing.two,
  },
  credit: {
    ...Typography.caption,
    marginTop: Spacing.four,
    color: Palette.inkSoft,
    fontFamily: Fonts.display,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  stickyActionDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    // Pas de bandeau derrière les boutons : il coupait les cartes en travers. Les deux
    // boutons flottent sur leur propre ombre, comme les boutons flottants du système.
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
