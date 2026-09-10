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
import { Fonts, Palette, Spacing, Typography } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import {
  historicalReferenceForFrame,
  referenceUriOf,
  validatedHistoricalReferenceUri,
} from '@/services/camera-reference';
import { saveCapture } from '@/services/fieldbook';
import { getReviewStatusRows, type CaptureLocation } from '@/services/review-status';

export function ReviewScreen() {
  const router = useRouter();
  const { id, frame, referenceUri, uri, simulated, roll, pitch, latitude, longitude, locationPrecision } = useLocalSearchParams<{
    id: string;
    frame?: string;
    referenceUri?: string;
    uri?: string;
    simulated?: string;
    roll?: string;
    pitch?: string;
    latitude?: string;
    longitude?: string;
    locationPrecision?: string;
  }>();
  const { detail } = useStationDetail(id);
  const [saved, setSaved] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [savedCaptureUri, setSavedCaptureUri] = useState<string>();
  const [comparisonActive, setComparisonActive] = useState(false);
  const isSimulated = simulated !== '0';
  const isArchiveSector = detail?.kind === 'archive-1970';
  const { images: archiveImages } = useBhvpImages(
    isArchiveSector ? detail?.archiveLinks : undefined,
  );
  const stationImages = archiveImages.length > 0 ? archiveImages : detail?.images ?? [];

  const requestedFrame = Number.parseInt(frame ?? '0', 10);
  const historicalReference = historicalReferenceForFrame({
    images: stationImages,
    recaptureImage: detail?.recaptureImage,
    referenceImage: detail?.referenceImage,
    requestedFrame,
  });
  const frameIndex = historicalReference.frameIndex;
  const transportedReferenceUri = validatedHistoricalReferenceUri({
    candidateUri: referenceUri,
    images: stationImages,
    recaptureImage: detail?.recaptureImage,
    referenceImage: detail?.referenceImage,
  });
  const referenceImage =
    transportedReferenceUri
      ? { uri: transportedReferenceUri }
      : historicalReference.image;
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
        frame: String(frameIndex),
        referenceUri: referenceUriOf(referenceImage) ?? '',
        uri: captureUri,
        simulated: isSimulated ? '1' : '0',
        currentSaved: saved && inLibrary ? '1' : '0',
      },
    });
  };

  const share = () =>
    Share.share({
      message: `J’ai retrouvé un point de vue de ${detail?.year ?? 1970} à Paris avec Paris GO.`,
      url: uri,
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
        {/* La comparaison est le sujet de l'écran : elle occupe toute la largeur, sans marge,
            juste sous l'en-tête. Tout ce qui suit n'est que légende. */}
        {referenceImage && currentImage ? (
          <BeforeAfterSlider
            before={referenceImage}
            after={currentImage}
            beforeLabel={String(detail?.year ?? 1970)}
            afterLabel={isSimulated ? 'DÉMO' : '2026'}
            borderRadius={0}
            onInteractionChange={setComparisonActive}
          />
        ) : null}

        <View style={styles.body}>
          <Text style={styles.kicker}>{isSimulated ? 'APERÇU SIMULATEUR' : 'PHOTO TERMINÉE'}</Text>
          <Text style={styles.title}>Le même lieu,{'\n'}deux époques.</Text>
          {hasTilt ? (
            <View style={styles.tiltRow}>
              <SymbolView
                name={isUpright ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                size={15}
                tintColor={isUpright ? Palette.lichen : Palette.brass}
              />
              <Text style={styles.tiltText}>
                {isUpright
                  ? 'Appareil droit à la prise de vue'
                  : `Appareil penché de ${Math.abs(rollDegrees).toFixed(0)}°, un nouvel essai est conseillé`}
              </Text>
            </View>
          ) : null}

          {isSimulated ? (
            <Text style={styles.noteText}>
              Cette comparaison utilise une scène parisienne de démonstration. Sur un iPhone, la
              moitié droite affichera la photo réellement prise.
            </Text>
          ) : null}

          <Text style={styles.noteText}>
            {saved && inLibrary
              ? 'Votre photo est enregistrée dans Photos (Récents). Le formulaire officiel peut maintenant être préparé sans ressaisir la date ni la position.'
              : 'Paris GO prépare le formulaire officiel, les deux images et les informations du point de vue. Vous gardez la main sur le règlement et l’envoi final.'}
          </Text>

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
            label={saved ? (inLibrary ? 'Enregistrée dans vos photos' : 'Ajoutée au carnet') : 'Enregistrer ma photo'}
            icon={saved ? 'checkmark' : 'bookmark'}
            loading={saving}
            disabled={saved}
            onPress={save}
          />
          {/* Le bouton seul ne suffisait pas à faire comprendre que l'enregistrement avait eu lieu :
              cette ligne confirme l'action à l'endroit même où l'utilisateur vient de taper. */}
          {saved ? (
            <View style={styles.saveConfirmation}>
              <SymbolView name="checkmark.circle.fill" size={16} tintColor={Palette.lichen} />
              <Text style={styles.saveConfirmationText}>
                {inLibrary
                  ? 'Photo enregistrée. Vous pouvez préparer le dépôt officiel.'
                  : 'Photo ajoutée au carnet de cette session.'}
              </Text>
            </View>
          ) : null}
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
        </View>
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
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  content: {
    paddingBottom: Spacing.five,
  },
  // Tout ce qui suit la comparaison vit dans cette colonne : la photo, elle, va bord à bord.
  body: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  kicker: {
    ...Typography.caption,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  // Titre de l'écran : un seul niveau « display » par vue, jamais combiné à « title ».
  title: {
    ...Typography.display,
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  tiltRow: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tiltText: {
    ...Typography.caption,
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  noteText: {
    ...Typography.body,
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  checklist: {
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
    gap: Spacing.twoHalf,
  },
  checklistKicker: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  checkRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  checkCopy: {
    flex: 1,
  },
  checkTitle: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  checkText: {
    ...Typography.body,
    marginTop: Spacing.half,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  secondaryButton: {
    marginTop: Spacing.two,
  },
  saveConfirmation: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  saveConfirmationText: {
    ...Typography.body,
    color: Palette.lichen,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  saveError: {
    ...Typography.body,
    marginTop: Spacing.two,
    color: Palette.copper,
    fontFamily: Fonts.sans,
  },
  collectiveLink: {
    minHeight: 50,
    marginTop: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  collectiveText: {
    ...Typography.body,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
