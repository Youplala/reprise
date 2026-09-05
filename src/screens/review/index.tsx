import * as Haptics from 'expo-haptics';
import type { ImageSource } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { PrimaryButton } from '@/components/primary-button';
import { SIMULATED_CAMERA_IMAGE } from '@/constants/demo';
import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import { saveCapture } from '@/services/fieldbook';
import { getReviewStatusRows, type CaptureLocation } from '@/services/review-status';

export function ReviewScreen() {
  const router = useRouter();
  const {
    id,
    frame,
    uri,
    simulated,
    roll,
    pitch,
    latitude,
    longitude,
    locationPrecision,
    captureId,
    resumed,
    currentSaved,
    currentPreparation,
    referencePreparation,
  } = useLocalSearchParams<{
    id: string;
    frame?: string;
    uri?: string;
    simulated?: string;
    roll?: string;
    pitch?: string;
    latitude?: string;
    longitude?: string;
    locationPrecision?: string;
    captureId?: string;
    resumed?: string;
    currentSaved?: string;
    currentPreparation?: string;
    referencePreparation?: string;
  }>();
  const { detail } = useStationDetail(id);
  const [saved, setSaved] = useState(resumed === '1');
  const [inLibrary, setInLibrary] = useState(currentSaved === '1');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [savedCaptureUri, setSavedCaptureUri] = useState<string | undefined>(
    resumed === '1' ? uri : undefined,
  );
  const [savedCaptureId, setSavedCaptureId] = useState<string | undefined>(captureId);
  const [savedCoordinate, setSavedCoordinate] = useState<{
    latitude: number;
    longitude: number;
  }>();
  const [comparisonActive, setComparisonActive] = useState(false);
  const isSimulated = simulated !== '0';
  const isArchiveSector = detail?.kind === 'archive-1970';
  const { images: archiveImages } = useBhvpImages(
    isArchiveSector ? detail?.archiveLinks : undefined,
  );
  const stationImages = archiveImages.length > 0 ? archiveImages : detail?.images ?? [];

  const requestedFrame = Number.parseInt(frame ?? '0', 10);
  const frameIndex = Number.isFinite(requestedFrame)
    ? Math.max(0, Math.min(Math.max(0, stationImages.length - 1), requestedFrame))
    : 0;
  const referenceImage =
    stationImages[frameIndex] ?? detail?.referenceImage;
  const currentImage: ImageSource | undefined = uri
    ? { uri }
    : isSimulated
      ? SIMULATED_CAMERA_IMAGE
      : detail?.recaptureImage;
  // Inclinaisons relevées au moment du déclenchement. Ce ne sont pas des scores de
  // ressemblance : l'app ne compare aucune image, elle rapporte ce que les capteurs ont mesuré.
  const rollDegrees = Number(roll);
  const pitchDegrees = Number(pitch);
  const hasTilt = Number.isFinite(rollDegrees) && Number.isFinite(pitchDegrees);
  const isUpright = hasTilt && Math.abs(rollDegrees) <= 2 && Math.abs(pitchDegrees) <= 8;
  const latitudeValue = Number(latitude);
  const longitudeValue = Number(longitude);
  const captureLocation: CaptureLocation | undefined =
    Number.isFinite(latitudeValue) &&
    Number.isFinite(longitudeValue) &&
    (locationPrecision === 'precise' || locationPrecision === 'approximate')
      ? { latitude: latitudeValue, longitude: longitudeValue, precision: locationPrecision }
      : undefined;
  const reviewStatusRows = getReviewStatusRows({
    simulated: isSimulated,
    location: captureLocation,
    saved,
    savedToLibrary: inLibrary,
  });

  const save = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      const { capture, savedToLibrary } = await saveCapture({
        stationId: id,
        stationName: detail?.name,
        stationAddress: detail?.address,
        frameIndex,
        imageUri: uri || undefined,
        simulated: isSimulated,
        roll: hasTilt ? rollDegrees : undefined,
        pitch: hasTilt ? pitchDegrees : undefined,
        coordinate: captureLocation
          ? { latitude: captureLocation.latitude, longitude: captureLocation.longitude }
          : undefined,
        locationPrecision: captureLocation?.precision,
      });
      setInLibrary(savedToLibrary);
      setSavedCaptureUri(capture.imageUri);
      setSavedCaptureId(capture.id);
      setSavedCoordinate(capture.coordinate);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
    } catch {
      setSaveError('La photo n’a pas pu être ajoutée au carnet. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const openObservatoire = () => {
    const captureUri = uri ?? savedCaptureUri ?? '';
    router.push({
      pathname: '/official-submit' as never,
      params: {
        id,
        captureId: savedCaptureId ?? '',
        frame: String(frameIndex),
        uri: captureUri,
        simulated: isSimulated ? '1' : '0',
        currentSaved: saved && inLibrary ? '1' : '0',
        currentPreparation: currentPreparation ?? '',
        referencePreparation: referencePreparation ?? '',
        latitude: savedCoordinate
          ? String(savedCoordinate.latitude)
          : captureLocation
            ? String(captureLocation.latitude)
            : '',
        longitude: savedCoordinate
          ? String(savedCoordinate.longitude)
          : captureLocation
            ? String(captureLocation.longitude)
            : '',
      },
    });
  };

  const share = () =>
    Share.share({
      message: `J’ai retrouvé un point de vue de ${detail?.year ?? 1970} à Paris avec Reprise.`,
      url: savedCaptureUri ?? uri,
    });

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <SymbolView name="xmark" size={17} tintColor={Palette.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Vérifier la photo</Text>
        <Pressable
          accessibilityLabel="Partager"
          onPress={share}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <SymbolView name="square.and.arrow.up" size={17} tintColor={Palette.ink} />
        </Pressable>
      </SafeAreaView>

      <ScrollView
        scrollEnabled={!comparisonActive}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.scoreRow}>
          <View>
            <Text style={styles.kicker}>{isSimulated ? 'APERÇU SIMULATEUR' : 'PHOTO TERMINÉE'}</Text>
            <Text style={styles.title}>Le même lieu,{'\n'}deux époques.</Text>
          </View>
          {hasTilt ? (
            <View style={styles.score}>
              <SymbolView
                name={isUpright ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                size={22}
                tintColor={isUpright ? Palette.lichen : Palette.brass}
              />
              <Text style={styles.scoreLabel}>
                {isUpright ? 'APPAREIL DROIT' : `${Math.abs(rollDegrees).toFixed(0)}° PENCHÉ`}
              </Text>
            </View>
          ) : null}
        </View>

        {referenceImage && currentImage ? (
          <BeforeAfterSlider
            before={referenceImage}
            after={currentImage}
            beforeLabel={String(detail?.year ?? 1970)}
            afterLabel={isSimulated ? 'DÉMO' : '2026'}
            onInteractionChange={setComparisonActive}
            style={styles.comparison}
          />
        ) : null}

        {isSimulated ? (
          <View style={styles.simulatorNote}>
            <SymbolView name="iphone.gen3" size={20} tintColor={Palette.parisBlue} />
            <Text style={styles.simulatorText}>
              Cette comparaison utilise une scène parisienne de démonstration. Sur un iPhone, la
              moitié droite affichera la photo réellement prise.
            </Text>
          </View>
        ) : null}

        <View style={styles.publishNote}>
          <View style={styles.publishIcon}>
            <SymbolView name="arrow.up.right.circle.fill" size={22} tintColor={Palette.parisBlue} />
          </View>
          <View style={styles.publishCopy}>
            <Text style={styles.publishTitle}>Comment votre photo rejoint la carte</Text>
            <Text style={styles.publishText}>
              {saved && inLibrary
                ? 'Votre photo est enregistrée dans Photos (Récents). Le formulaire officiel peut maintenant être préparé sans ressaisir la date ni la position.'
                : 'Reprise prépare le formulaire officiel, les deux images et les informations du point de vue. Vous gardez la main sur le règlement et l’envoi final.'}
            </Text>
          </View>
        </View>

        <View style={styles.checklist}>
          <Text style={styles.checklistKicker}>CONTRÔLE AVANT DÉPÔT</Text>
          {[
            ...reviewStatusRows.map(({ icon, title, copy }) => [icon, title, copy] as const),
            [
              !hasTilt || isUpright ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill',
              'Tenue de l’appareil',
              !hasTilt
                ? 'Non mesurée'
                : isUpright
                  ? 'Appareil droit à la prise de vue'
                  : 'L’appareil penchait, un nouvel essai est conseillé',
            ],
          ].map(([icon, title, copy]) => (
            <View key={title} style={styles.checkRow}>
              <SymbolView
                name={icon as 'checkmark.circle.fill'}
                size={21}
                tintColor={
                  icon.startsWith('check')
                    ? Palette.lichen
                    : icon.startsWith('info')
                      ? Palette.parisBlue
                      : Palette.copper
                }
              />
              <View style={styles.checkCopy}>
                <Text style={styles.checkTitle}>{title}</Text>
                <Text style={styles.checkText}>{copy}</Text>
              </View>
            </View>
          ))}
        </View>

        <PrimaryButton
          label={saved ? (inLibrary ? 'Conservée et enregistrée dans Photos' : 'Conservée dans le carnet') : 'Enregistrer ma photo'}
          icon={saved ? 'checkmark' : 'bookmark'}
          loading={saving}
          disabled={saved}
          onPress={save}
        />
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        <PrimaryButton
          label="Préparer le dépôt officiel"
          icon="lock.shield"
          variant="outline"
          onPress={openObservatoire}
          style={styles.secondaryButton}
        />
        <Pressable onPress={() => router.replace('/collective')} style={styles.collectiveLink}>
          <Text style={styles.collectiveText}>Voir les photos de la communauté</Text>
          <SymbolView name="person.2.fill" size={16} tintColor={Palette.parisBlue} />
        </Pressable>
      </ScrollView>
    </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.line,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Palette.ink,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  scoreRow: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.7,
  },
  title: {
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 39,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  score: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Palette.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: Palette.blueDeep,
    fontFamily: Fonts.display,
    fontSize: 30,
    lineHeight: 31,
    fontWeight: '900',
  },
  scoreLabel: {
    color: Palette.blueDeep,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  comparison: {
    marginTop: Spacing.four,
  },
  simulatorNote: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Palette.blueMist,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  publishNote: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    flexDirection: 'row',
    gap: Spacing.twoHalf,
  },
  publishIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.blueMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishCopy: {
    flex: 1,
  },
  publishTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
  },
  publishText: {
    marginTop: 3,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  simulatorText: {
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  checklist: {
    marginVertical: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
  },
  checklistKicker: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.6,
    marginBottom: Spacing.two,
  },
  checkRow: {
    paddingVertical: Spacing.twoHalf,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.line,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  checkCopy: {
    flex: 1,
  },
  checkTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
  },
  checkText: {
    marginTop: 2,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  secondaryButton: {
    marginTop: Spacing.two,
  },
  saveError: {
    marginTop: Spacing.two,
    color: Palette.copper,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  publishError: {
    marginTop: Spacing.two,
    color: Palette.copper,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  collectiveLink: {
    minHeight: 50,
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  collectiveText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
