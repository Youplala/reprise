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
import { PARIS_CENTER } from '@/data/archive';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';

const REPRISE_HOME_URL = 'https://reprise.paris';

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
  // Un carré de 1970 couvre une maille de 250 m : on trace son emprise réelle plutôt qu'un point.
  const squareBounds = detail?.bounds ?? summary?.bounds;
  const referenceYear = detail?.year ?? summary?.year ?? 1970;
  const title = detail?.name ?? summary?.name ?? 'Point de vue';
  const selectedViewNumber = String(selectedIndex + 1).padStart(2, '0');
  const coordinate = detail?.coordinate ?? summary?.coordinate ?? PARIS_CENTER;
  const referenceImage = detail?.referenceImage;
  const recaptureImage = detail?.recaptureImage;
  const hasComparison = Boolean(detail?.hasRecapture && referenceImage && recaptureImage);
  const recaptureIndex =
    recaptureImage && images.length > 1 ? images.length - 1 : undefined;
  const availableYears = useMemo<TimelineYear[]>(() => {
    const years: TimelineYear[] = [referenceYear];
    if (recaptureIndex !== undefined) years.push(2026);
    return years;
  }, [recaptureIndex, referenceYear]);
  const activeYear = timelineSelection ?? referenceYear;
  const shareUrl = id
    ? `${REPRISE_HOME_URL}/station/${encodeURIComponent(id)}`
    : REPRISE_HOME_URL;

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
    const url = detail?.officialUrl ?? 'https://observatoire-photo.paris/map';
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(
          'Source indisponible',
          'La page officielle ne peut pas être ouverte sur cet appareil.',
        );
        return;
      }
      await Linking.openURL(url);
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
    const subject = `Signalement d’une photo refaite · ${title}`;
    const body = [
      'Bonjour,',
      '',
      `Je souhaite signaler un problème sur la photo actuelle associée à « ${title} » (identifiant ${id ?? 'inconnu'}).`,
      detail?.officialUrl ? `Fiche : ${detail.officialUrl}` : '',
      '',
      'Problème constaté : ',
    ]
      .filter(Boolean)
      .join('\n');
    const mailto = `mailto:observatoire-photo@caue75.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Alert.alert(
      'Signaler cette photo',
      'Un brouillon d’email va être préparé pour l’équipe de l’Observatoire. Vous pourrez décrire le problème avant de l’envoyer.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Préparer l’email',
          onPress: () => {
            void Linking.openURL(mailto);
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
          message: `Découvrez « ${title} » avant et aujourd’hui dans Reprise : ${shareUrl}`,
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
    const message = `Découvrez « ${title} » en 1970 et aujourd’hui avec Reprise.`;
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
              : detail?.description ??
                (detail?.approximate ?? summary?.approximate
                  ? 'Le point de vue exact reste à retrouver dans cette zone.'
                  : 'Un point de vue de référence de l’Observatoire photo participatif des paysages parisiens.')}
          </Text>

          {hasComparison && referenceImage && recaptureImage ? (
            <View style={styles.recaptureBlock}>
              <View style={styles.recaptureCard}>
                <View style={styles.recaptureBody}>
                  <Text style={styles.recaptureKicker}>1970 → AUJOURD’HUI</Text>
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
                      <Text style={styles.recaptureArchiveCredit}>ARCHIVE 1970 · BHVP</Text>
                      <Text style={styles.recaptureCredit} numberOfLines={1}>
                        {detail?.currentAuthor
                          ? `Photo actuelle · ${detail.currentAuthor}`
                          : 'Photo actuelle · Communauté'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.repriseMark}>
                    <Text style={styles.repriseMarkName}>REPRISE</Text>
                    <Text style={styles.repriseMarkUrl}>reprise.paris</Text>
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
                <Text style={styles.recaptureArchiveCredit}>ARCHIVE 1970 · BHVP</Text>
                <Text style={styles.recaptureCredit} numberOfLines={1}>
                  {detail?.currentAuthor
                    ? `Photo actuelle · ${detail.currentAuthor}`
                    : 'Photo actuelle · Communauté'}
                </Text>
              </View>
              <View style={styles.repriseMark}>
                <Text style={styles.repriseMarkName}>REPRISE</Text>
                <Text style={styles.repriseMarkUrl}>reprise.paris</Text>
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
  description: {
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
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
    minHeight: 70,
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
