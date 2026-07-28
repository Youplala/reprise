import * as Haptics from 'expo-haptics';
import type { ImageSource } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Polygon } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { ArchiveFilmstrip } from '@/components/archive-filmstrip';
import { BeforeAfterSlider } from '@/components/before-after-slider';
import { PhotoViewer } from '@/components/photo-viewer';
import { PrimaryButton } from '@/components/primary-button';
import { SourcePill } from '@/components/source-pill';
import {
  TimeTravelSlider,
  type TimelineYear,
} from '@/components/time-travel-slider';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { PARIS_CENTER } from '@/data/archive';
import { useStationDetail } from '@/hooks/use-station-detail';

function MetadataCell({
  icon,
  label,
  value,
}: {
  icon: 'calendar' | 'mappin.and.ellipse' | 'camera' | 'viewfinder';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metadataCell}>
      <SymbolView name={icon} size={18} tintColor={Palette.parisBlue} />
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue} numberOfLines={2}>
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
  const archiveCount = detail?.archiveLinks.length || summary?.frameCount || 0;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [timelineSelection, setTimelineSelection] = useState<TimelineYear>();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [comparisonActive, setComparisonActive] = useState(false);

  const images = detail?.images ?? (summary?.previewImage ? [summary.previewImage] : []);
  const selectedImage = (images[selectedIndex] ?? images[0]) as ImageSource | undefined;
  // Un carré de 1970 couvre une maille de 250 m : on trace son emprise réelle plutôt qu'un point.
  const squareBounds = detail?.bounds ?? summary?.bounds;
  const referenceYear = detail?.year ?? summary?.year ?? 1970;
  const activeYear = timelineSelection ?? referenceYear;
  const title = detail?.name ?? summary?.name ?? 'Point de vue';
  const coordinate = detail?.coordinate ?? summary?.coordinate ?? PARIS_CENTER;
  const recaptureIndex =
    detail?.recaptureImage && images.length > 1 ? images.length - 1 : undefined;
  const availableYears = useMemo<TimelineYear[]>(() => {
    const years: TimelineYear[] = [referenceYear];
    if (recaptureIndex !== undefined) years.push(2026);
    return years;
  }, [recaptureIndex, referenceYear]);

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
        <Text style={styles.loadingText}>Ouverture de la station…</Text>
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

  const reportRecapture = () => {
    const subject = `Signalement d’une reprise · ${title}`;
    const body = [
      'Bonjour,',
      '',
      `Je souhaite signaler un problème sur la reprise de la station « ${title} » (identifiant ${id ?? 'inconnu'}).`,
      detail?.officialUrl ? `Fiche : ${detail.officialUrl}` : '',
      '',
      'Problème constaté : ',
    ]
      .filter(Boolean)
      .join('\n');
    const mailto = `mailto:observatoire-photo@caue75.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Alert.alert(
      'Signaler cette reprise',
      'Un brouillon d’email va être préparé pour l’équipe de l’Observatoire. Vous pourrez décrire la photo en cause avant de l’envoyer.',
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
                  accessibilityLabel={`Agrandir la vue ${index + 1}`}
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
                {archiveCount} {archiveCount > 1 ? 'photos de 1970' : 'photo de 1970'}
              </Text>
              <Text style={styles.heroPlaceholderCopy}>
                Elles sont conservées par la Bibliothèque historique de la Ville de Paris.
                Ouvrez-les pour reconnaître le lieu, puis revenez ici.
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
              accessibilityLabel="Ouvrir la source officielle"
              onPress={openOfficial}
              style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
              <SymbolView name="safari" size={19} tintColor={Palette.ink} />
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

        <TimeTravelSlider
          activeYear={activeYear}
          availableYears={availableYears}
          onSelect={selectYear}
        />

        {images.length > 1 ? (
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
            {detail?.hasRecapture
              ? 'REPRISE PUBLIÉE · ZONE À PRÉCISER'
              : detail?.approximate ?? summary?.approximate
                ? 'MISSION À LOCALISER'
                : 'POINT DE VUE GÉOLOCALISÉ'}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>
            {detail?.description ??
              (detail?.approximate ?? summary?.approximate
                ? `Ce quartier de 250 m contient ${archiveCount} ${archiveCount > 1 ? 'vues' : 'vue'} prises en 1970. Leur emplacement exact reste à retrouver : c’est tout l’intérêt.`
                : 'Un point de vue de référence de l’Observatoire photo participatif des paysages parisiens.')}
          </Text>

          <View style={styles.howItWorks}>
            <View style={styles.howItWorksIcon}>
              <SymbolView name="viewfinder" size={20} tintColor={Palette.parisBlue} />
            </View>
            <View style={styles.howItWorksCopy}>
              <Text style={styles.howItWorksTitle}>Comment contribuer</Text>
              <Text style={styles.howItWorksText}>
                Allez sur place, alignez l’archive avec votre caméra, prenez votre photo, puis vérifiez-la avant publication.
              </Text>
            </View>
          </View>

          <View style={styles.metadataGrid}>
            <MetadataCell
              icon="calendar"
              label="Référence"
              value={detail?.dateLabel ?? String(detail?.year ?? summary?.year ?? 1970)}
            />
            <MetadataCell
              icon="mappin.and.ellipse"
              label="Secteur"
              value={detail?.arrondissement ?? summary?.arrondissement ?? 'Paris'}
            />
            <MetadataCell
              icon="camera"
              label="Auteur"
              value={detail?.author ?? 'Archive participative'}
            />
            <MetadataCell
              icon="viewfinder"
              label="Précision"
              value={detail?.approximate ?? summary?.approximate ? 'Carré de 250 m' : 'Point exact'}
            />
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionKicker}>OÙ CHERCHER</Text>
              <Text style={styles.sectionTitle}>
                {detail?.approximate ?? summary?.approximate ? 'Chercher dans ce quartier' : 'Revenir à ce point'}
              </Text>
            </View>
          </View>

          <View style={styles.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              region={region}
              mapType="mutedStandard"
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
            <View style={styles.mapLegend}>
              <Text style={styles.mapLegendText}>
                {squareBounds
                  ? `GRILLE OFFICIELLE 1970 · N°${detail?.name ?? summary?.name ?? ''}`
                  : 'POSITION OBSERVATOIRE'}
              </Text>
            </View>
          </View>

          <View style={styles.fieldNote}>
            <View style={styles.fieldNoteIcon}>
              <SymbolView name="eye" size={22} tintColor={Palette.parisBlue} />
            </View>
            <View style={styles.fieldNoteCopy}>
              <Text style={styles.fieldNoteTitle}>Indice de terrain</Text>
              <Text style={styles.fieldNoteText}>
                Cherchez d’abord les lignes durables : corniches, fenêtres, pente de la chaussée et
                profondeur des cours. Elles résistent mieux que les enseignes.
              </Text>
            </View>
          </View>

          {detail?.hasRecapture && detail.referenceImage && detail.recaptureImage ? (
            <View style={styles.recaptureCard}>
              <BeforeAfterSlider
                before={detail.referenceImage}
                after={detail.recaptureImage}
                beforeLabel={String(detail.year)}
                afterLabel="2026"
                borderRadius={0}
                onInteractionChange={setComparisonActive}
              />
              <View style={styles.recaptureBody}>
                <Text style={styles.recaptureKicker}>REPRISE PUBLIÉE</Text>
                <Text style={styles.recaptureTitle}>Comparer avec la vue actuelle</Text>
                {detail.currentAuthor ? (
                  <Text style={styles.recaptureCredit}>Par {detail.currentAuthor}</Text>
                ) : null}
                <Text style={styles.recaptureRetry}>
                  Une reprise publiée peut être retentée. Choisissez la meilleure vue, puis utilisez
                  le bouton photo pour proposer un cadrage plus fidèle.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={reportRecapture}
                  style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                  <SymbolView
                    name="exclamationmark.bubble"
                    size={15}
                    tintColor={Palette.copper}
                  />
                  <Text style={styles.reportText}>Signaler un problème avec cette reprise</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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
      {selectedImage && !viewerVisible ? (
        <Pressable
          accessibilityHint="Ouvre le viseur avec cette image en superposition"
          accessibilityLabel={`${detail?.hasRecapture ? 'Proposer une nouvelle reprise' : 'Commencer l’alignement'} avec la vue ${selectedIndex + 1}`}
          accessibilityRole="button"
          onPress={openAlignment}
          style={({ pressed }) => [
            styles.floatingCamera,
            { bottom: Math.max(insets.bottom, 12) + 16 },
            pressed && styles.floatingCameraPressed,
          ]}>
          <SymbolView name="camera.fill" size={25} tintColor={Palette.white} />
          <View style={styles.floatingFrameBadge}>
            <Text style={styles.floatingFrameText}>
              {String(selectedIndex + 1).padStart(2, '0')}
            </Text>
          </View>
        </Pressable>
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
    paddingBottom: 112,
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
  howItWorks: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Palette.blueMist,
    flexDirection: 'row',
    gap: Spacing.twoHalf,
  },
  howItWorksIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howItWorksCopy: {
    flex: 1,
  },
  howItWorksTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
  },
  howItWorksText: {
    marginTop: 3,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  metadataGrid: {
    marginTop: Spacing.four,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
  },
  metadataCell: {
    width: '50%',
    minHeight: 112,
    padding: Spacing.three,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    backgroundColor: Palette.white,
  },
  metadataLabel: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metadataValue: {
    marginTop: 4,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
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
    height: 250,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
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
  fieldNote: {
    marginVertical: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Palette.blueMist,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  fieldNoteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldNoteCopy: {
    flex: 1,
  },
  fieldNoteTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '800',
  },
  fieldNoteText: {
    marginTop: 4,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  recaptureCard: {
    marginBottom: Spacing.four,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.white,
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
  recaptureCredit: {
    marginTop: 5,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  recaptureRetry: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  reportButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    marginTop: Spacing.three,
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
  floatingCamera: {
    position: 'absolute',
    right: Spacing.three,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: Palette.white,
    backgroundColor: Palette.parisBlue,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  floatingCameraPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: Palette.blueDeep,
  },
  floatingFrameBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    minWidth: 23,
    height: 23,
    paddingHorizontal: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Palette.white,
    backgroundColor: Palette.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingFrameText: {
    color: Palette.blueDeep,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
