import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, {
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';

import { PrimaryButton } from '@/components/primary-button';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import { useUserLocation } from '@/hooks/use-user-location';
import {
  buildOfficialFormUsabilityScript,
  officialChromeIsExpanded,
} from '@/services/official-form-usability';
import {
  didAddReadyImage,
  tryStartImagePreparation,
} from '@/services/official-image-preparation';
import { OFFICIAL_SUBMISSION_FIXTURE_HTML } from '@/services/official-submission-fixture';
import {
  buildObservatoirePrefillScript,
  OFFICIAL_SUBMISSION_FIXTURE_ENABLED,
  OBSERVATOIRE_CONTRIBUTION_URL,
  OBSERVATOIRE_HOST,
  parseOfficialBridgeMessage,
  prepareImagesForOfficialForm,
  type PreparedImages,
} from '@/services/official-submission';

function preparationErrorLabel(error: PreparedImages['current']['error']) {
  switch (error) {
    case 'permission-denied':
      return 'Accès Photos refusé — autorisez Reprise dans Réglages.';
    case 'missing-uri':
      return 'Fichier absent — choisissez cette image manuellement dans le formulaire.';
    case 'download-failed':
      return 'Téléchargement impossible — vérifiez le réseau puis réessayez.';
    case 'file-too-large':
      return 'Fichier supérieur à 8 Mo — choisissez une version plus légère.';
    case 'size-check-failed':
      return 'Taille du fichier invérifiable — choisissez cette image manuellement.';
    case 'unsupported-format':
      return 'Format non pris en charge — choisissez cette image manuellement.';
    case 'save-failed':
      return 'Écriture dans Photos impossible — réessayez ou choisissez le fichier manuellement.';
    default:
      return undefined;
  }
}

function localIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function postalCodeFrom(value?: string, arrondissement?: string) {
  const explicit = `${value ?? ''} ${arrondissement ?? ''}`.match(/\b750\d{2}\b/)?.[0];
  if (explicit) return explicit;
  const number = arrondissement?.match(/(?:^|\D)([1-9]|1\d|20)(?:er|e|ème)?(?:\D|$)/)?.[1];
  return number ? `750${number.padStart(2, '0')}` : undefined;
}

export function OfficialSubmissionScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const imagePreparationInFlight = useRef(false);
  const { id, frame, uri, simulated, currentSaved } = useLocalSearchParams<{
    id: string;
    frame?: string;
    uri?: string;
    simulated?: string;
    currentSaved?: string;
  }>();
  const { detail } = useStationDetail(id);
  const isArchiveSector = detail?.kind === 'archive-1970';
  const { images: archiveImages } = useBhvpImages(
    isArchiveSector ? detail?.archiveLinks : undefined,
  );
  const requestedFrame = Number.parseInt(frame ?? '0', 10);
  const frameIndex = Number.isFinite(requestedFrame)
    ? Math.max(0, Math.min(Math.max(0, archiveImages.length - 1), requestedFrame))
    : 0;
  const referenceSource =
    archiveImages[frameIndex] ?? detail?.images[frameIndex] ?? detail?.referenceImage;
  const referenceUri =
    typeof referenceSource === 'object' && referenceSource ? referenceSource.uri : undefined;
  const isSimulated = simulated !== '0';
  const { coordinate, isPrecise, loading: locating, error: locationError, locate } =
    useUserLocation();
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string>();
  const [webKey, setWebKey] = useState(0);
  const [prefilledCount, setPrefilledCount] = useState(0);
  const [validationMessage, setValidationMessage] = useState<string>();
  const [submissionStatus, setSubmissionStatus] = useState<'editing' | 'success'>('editing');
  const [preparingImages, setPreparingImages] = useState(false);
  const [preparedImages, setPreparedImages] = useState<PreparedImages>({
    current: { ready: currentSaved === '1' },
    reference: { ready: false },
  });
  const [imageError, setImageError] = useState<string>();
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (!isSimulated) void locate();
  }, [isSimulated, locate]);

  const prefill = useMemo(() => {
    const exactStationCoordinate = detail && !detail.approximate ? detail.coordinate : undefined;
    const submissionCoordinate = isPrecise ? coordinate : exactStationCoordinate;
    const referenceUrl = isArchiveSector
      ? detail?.archiveLinks[frameIndex]
      : detail?.officialUrl;
    return {
      address: detail && !detail.approximate ? detail.address : undefined,
      captureDate: localIsoDate(),
      city: 'Paris',
      device: Device.modelName ?? Device.deviceName ?? 'Smartphone',
      latitude: submissionCoordinate?.latitude,
      longitude: submissionCoordinate?.longitude,
      note: referenceUrl
        ? `Reprise de la vue de ${detail?.year ?? 1970} — référence : ${referenceUrl}`
        : `Reprise de la vue de ${detail?.year ?? 1970}`,
      postalCode: postalCodeFrom(detail?.address, detail?.arrondissement),
    };
  }, [coordinate, detail, frameIndex, isArchiveSector, isPrecise]);
  const injectedScript = useMemo(
    () => `${buildOfficialFormUsabilityScript()}\n${buildObservatoirePrefillScript(prefill)}`,
    [prefill],
  );
  const webSource = useMemo(
    () =>
      OFFICIAL_SUBMISSION_FIXTURE_ENABLED
        ? { html: OFFICIAL_SUBMISSION_FIXTURE_HTML }
        : { uri: OBSERVATOIRE_CONTRIBUTION_URL },
    [],
  );

  useEffect(() => {
    webViewRef.current?.injectJavaScript(injectedScript);
  }, [injectedScript]);

  const openSafari = useCallback(async () => {
    try {
      await Linking.openURL(OBSERVATOIRE_CONTRIBUTION_URL);
    } catch {
      setFormError('Safari ne peut pas ouvrir le formulaire pour le moment.');
    }
  }, []);

  const retry = () => {
    setFormError(undefined);
    setLoading(true);
    setWebKey((key) => key + 1);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseOfficialBridgeMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'prefill') setPrefilledCount(message.count);
    if (message.type === 'success') {
      setSubmissionStatus('success');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (message.type === 'form-error') {
      setValidationMessage(
        message.message || 'Le formulaire officiel signale un champ à vérifier.',
      );
    }
    if (message.type === 'contract-error') {
      setFormError(message.message);
    }
  };

  const onNavigationChange = (navigation: WebViewNavigation) => {
    if (/\/(elements\/add|map)(?:[/?#]|$)/.test(navigation.url)) return;
    if (/\/elements\/added(?:[/?#]|$)/.test(navigation.url)) {
      setSubmissionStatus('success');
    }
  };

  const prepareImages = async () => {
    if (isSimulated) {
      setImageError('Mode démo : aucune fausse photo ne sera placée dans votre photothèque.');
      return;
    }
    if (!tryStartImagePreparation(imagePreparationInFlight)) return;
    const previous = preparedImages;
    setPreparingImages(true);
    setImageError(undefined);
    try {
      const result = await prepareImagesForOfficialForm({
        currentAlreadySaved: currentSaved === '1',
        currentUri: uri,
        previous,
        referenceUri,
        stationId: id,
      });
      setPreparedImages(result);
      if (didAddReadyImage(previous, result)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setImageError('La préparation a été interrompue. Les fichiers déjà prêts restent disponibles.');
    } finally {
      imagePreparationInFlight.current = false;
      setPreparingImages(false);
    }
  };

  const allowNavigation = (request: { url: string }) => {
    if (request.url === 'about:blank') return true;
    try {
      const url = new URL(request.url);
      if (url.hostname === OBSERVATOIRE_HOST || url.hostname.endsWith('.observatoire-photo.paris')) {
        return true;
      }
      void Linking.openURL(request.url);
      return false;
    } catch {
      return false;
    }
  };

  const preparedCount =
    Number(preparedImages.reference.ready) + Number(preparedImages.current.ready);
  const hasPreparationError = Boolean(
    preparedImages.current.error || preparedImages.reference.error,
  );
  const permissionDenied =
    preparedImages.current.error === 'permission-denied' ||
    preparedImages.reference.error === 'permission-denied';
  const chromeExpanded = officialChromeIsExpanded({
    detailsRequested: detailsExpanded,
    hasBlockingMessage: Boolean(imageError || validationMessage || hasPreparationError),
  });

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Fermer le formulaire"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <SymbolView name="xmark" size={17} tintColor={Palette.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerKicker}>
              {OFFICIAL_SUBMISSION_FIXTURE_ENABLED ? 'TEST LOCAL' : 'DÉPÔT OFFICIEL'}
            </Text>
            <Text style={styles.headerTitle}>
              {OFFICIAL_SUBMISSION_FIXTURE_ENABLED ? 'Formulaire WebView' : 'Observatoire de Paris'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Ouvrir dans Safari"
            onPress={openSafari}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <SymbolView name="safari" size={18} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>
      </SafeAreaView>

      {chromeExpanded ? (
        <>
          <View style={styles.trustBanner}>
            <View style={styles.secureIcon}>
              <SymbolView name="lock.shield.fill" size={18} tintColor={Palette.lichen} />
            </View>
            <View style={styles.trustCopy}>
              <Text style={styles.trustTitle}>
                {OFFICIAL_SUBMISSION_FIXTURE_ENABLED
                  ? 'Formulaire de test embarqué'
                  : 'Formulaire officiel du CAUE de Paris'}
              </Text>
              <Text style={styles.trustText}>
                {OFFICIAL_SUBMISSION_FIXTURE_ENABLED
                  ? 'Aucune donnée ni photo ne quitte cet appareil.'
                  : 'Reprise ne reçoit ni votre identité ni vos photos. Elles partent du formulaire officiel.'}
              </Text>
            </View>
            <View style={styles.prefillBadge}>
              <Text style={styles.prefillValue}>{prefilledCount || '—'}</Text>
              <Text style={styles.prefillLabel}>CHAMPS</Text>
            </View>
          </View>
          <View style={styles.preparationRow}>
            <View style={styles.preparationCopy}>
              <Text style={styles.preparationTitle}>
                {isSimulated
                  ? 'Aperçu de démonstration'
                  : preparedCount === 2
                    ? 'Les 2 photos sont prêtes'
                    : `${preparedCount}/2 photo${preparedCount > 1 ? 's' : ''} prête${preparedCount > 1 ? 's' : ''}`}
              </Text>
              <Text style={styles.preparationText}>
                {isPrecise
                  ? 'Position actuelle et date préparées'
                  : locating
                    ? 'Recherche de votre position…'
                    : locationError ?? 'Date et informations du point de vue préparées'}
              </Text>
              <Text style={preparedImages.current.ready ? styles.fileReady : styles.filePending}>
                {preparedImages.current.ready
                  ? '✓ Photo 2026 prête'
                  : `Photo 2026 : ${preparationErrorLabel(preparedImages.current.error) ?? 'à préparer'}`}
              </Text>
              <Text style={preparedImages.reference.ready ? styles.fileReady : styles.filePending}>
                {preparedImages.reference.ready
                  ? '✓ Archive prête'
                  : `Archive : ${preparationErrorLabel(preparedImages.reference.error) ?? 'à préparer'}`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={preparingImages}
              onPress={prepareImages}
              style={({ pressed }) => [
                styles.prepareButton,
                pressed && styles.pressed,
                preparingImages && styles.disabled,
              ]}>
              {preparingImages ? (
                <ActivityIndicator color={Palette.parisBlue} size="small" />
              ) : (
                <SymbolView name="photo.on.rectangle.angled" size={18} tintColor={Palette.parisBlue} />
              )}
              <Text style={styles.prepareLabel}>
                {isSimulated ? 'Voir le parcours' : hasPreparationError ? 'Réessayer' : 'Préparer'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel="Réduire les informations du dépôt"
            accessibilityRole="button"
            onPress={() => setDetailsExpanded(false)}
            style={({ pressed }) => [styles.collapseButton, pressed && styles.pressed]}>
            <Text style={styles.collapseLabel}>Agrandir le formulaire</Text>
            <SymbolView name="chevron.up" size={11} tintColor={Palette.parisBlue} />
          </Pressable>
        </>
      ) : (
        <View style={styles.compactBar}>
          <Text style={styles.compactStatus} numberOfLines={1}>
            {prefilledCount || '—'} champs · {preparedCount}/2 photos prêtes
          </Text>
          <Pressable
            accessibilityLabel="Préparer les photos"
            accessibilityRole="button"
            disabled={preparingImages}
            onPress={prepareImages}
            style={({ pressed }) => [styles.compactAction, pressed && styles.pressed]}>
            {preparingImages ? (
              <ActivityIndicator color={Palette.parisBlue} size="small" />
            ) : (
              <SymbolView name="photo.on.rectangle.angled" size={16} tintColor={Palette.parisBlue} />
            )}
            <Text style={styles.compactActionLabel}>Photos</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Afficher les informations du dépôt"
            accessibilityRole="button"
            onPress={() => setDetailsExpanded(true)}
            style={({ pressed }) => [styles.compactAction, pressed && styles.pressed]}>
            <SymbolView name="info.circle" size={16} tintColor={Palette.parisBlue} />
            <Text style={styles.compactActionLabel}>Infos</Text>
          </Pressable>
        </View>
      )}
      {imageError ? <Text style={styles.inlineError}>{imageError}</Text> : null}
      {permissionDenied ? (
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
          <Text style={styles.settingsLink}>Ouvrir les réglages Photos</Text>
        </Pressable>
      ) : null}
      {validationMessage ? (
        <View style={styles.validationBanner}>
          <SymbolView name="exclamationmark.circle.fill" size={15} tintColor={Palette.copper} />
          <Text numberOfLines={2} style={styles.validationText}>
            {validationMessage}
          </Text>
          <Pressable
            accessibilityLabel="Fermer l’avertissement"
            onPress={() => setValidationMessage(undefined)}>
            <SymbolView name="xmark" size={12} tintColor={Palette.inkSoft} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.webContainer}>
        {submissionStatus === 'success' ? (
          <View style={styles.successState}>
            <View style={styles.successIcon}>
              <SymbolView name="checkmark" size={32} tintColor={Palette.white} />
            </View>
            <Text style={styles.successTitle}>
              {OFFICIAL_SUBMISSION_FIXTURE_ENABLED ? 'Parcours validé' : 'Contribution transmise'}
            </Text>
            <Text style={styles.successText}>
              {OFFICIAL_SUBMISSION_FIXTURE_ENABLED
                ? 'Les champs, les deux sélecteurs de photos et le bridge WebView fonctionnent. Aucune contribution n’a été envoyée.'
                : 'Elle rejoint maintenant la file de modération de l’Observatoire. Le CAUE pourra vous contacter à l’adresse renseignée dans le formulaire.'}
            </Text>
            <PrimaryButton label="Revenir à la carte" onPress={() => router.replace('/map')} />
          </View>
        ) : formError ? (
          <View style={styles.errorState}>
            <SymbolView name="wifi.exclamationmark" size={34} tintColor={Palette.copper} />
            <Text style={styles.errorTitle}>Le formulaire répond mal</Text>
            <Text style={styles.errorText}>{formError}</Text>
            <PrimaryButton label="Réessayer" icon="arrow.clockwise" onPress={retry} />
            <PrimaryButton
              label="Continuer dans Safari"
              icon="safari"
              variant="outline"
              onPress={openSafari}
              style={styles.safariButton}
            />
          </View>
        ) : (
          <>
            <WebView
              key={webKey}
              ref={webViewRef}
              source={webSource}
              originWhitelist={['https://*']}
              allowsBackForwardNavigationGestures
              allowsInlineMediaPlayback
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled={false}
              injectedJavaScript={injectedScript}
              injectedJavaScriptBeforeContentLoaded={injectedScript}
              onLoadStart={() => {
                setLoading(true);
                setFormError(undefined);
                setValidationMessage(undefined);
                setPrefilledCount(0);
              }}
              onLoadEnd={() => {
                setLoading(false);
                webViewRef.current?.injectJavaScript(injectedScript);
              }}
              onMessage={onMessage}
              onNavigationStateChange={onNavigationChange}
              onShouldStartLoadWithRequest={allowNavigation}
              onError={() => {
                setLoading(false);
                setFormError(
                  'Le serveur officiel de l’Observatoire ne répond pas. Ce problème est extérieur à vos photos et à Reprise.',
                );
              }}
              onHttpError={(event) => {
                if (
                  event.nativeEvent.url.startsWith(OBSERVATOIRE_CONTRIBUTION_URL) &&
                  event.nativeEvent.statusCode >= 400
                ) {
                  setFormError(`Le formulaire officiel répond avec l’erreur ${event.nativeEvent.statusCode}.`);
                }
              }}
              style={styles.webView}
            />
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={Palette.parisBlue} />
                <Text style={styles.loadingText}>
                  {OFFICIAL_SUBMISSION_FIXTURE_ENABLED
                    ? 'Chargement du formulaire de test…'
                    : 'Connexion au formulaire officiel…'}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      {chromeExpanded ? (
        <SafeAreaView edges={['bottom']} style={styles.manualFooter}>
          <SymbolView name="hand.tap.fill" size={18} tintColor={Palette.brass} />
          <Text style={styles.manualText}>
            Les photos, le règlement et le bouton d’envoi restent entièrement sous votre contrôle.
          </Text>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  headerSafeArea: {
    backgroundColor: Palette.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.line,
  },
  header: {
    height: 62,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.fog,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  headerTitle: {
    marginTop: 2,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '800',
  },
  trustBanner: {
    margin: Spacing.two,
    marginBottom: 0,
    padding: Spacing.twoHalf,
    borderRadius: Radius.medium,
    backgroundColor: Palette.blueMist,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  secureIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustCopy: { flex: 1 },
  trustTitle: { color: Palette.ink, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800' },
  trustText: {
    marginTop: 2,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
  },
  prefillBadge: { minWidth: 42, alignItems: 'center' },
  prefillValue: { color: Palette.parisBlue, fontFamily: Fonts.display, fontSize: 22, fontWeight: '900' },
  prefillLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  preparationRow: {
    minHeight: 62,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  preparationCopy: { flex: 1, paddingVertical: Spacing.two },
  preparationTitle: { color: Palette.ink, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800' },
  preparationText: { marginTop: 2, color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 10 },
  fileReady: {
    marginTop: 3,
    color: Palette.lichen,
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '700',
  },
  filePending: {
    marginTop: 3,
    color: Palette.copper,
    fontFamily: Fonts.sans,
    fontSize: 9,
    lineHeight: 12,
  },
  compactBar: {
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  compactStatus: {
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
  },
  compactAction: {
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  compactActionLabel: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
  },
  collapseButton: {
    minHeight: 32,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  collapseLabel: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
  },
  prepareButton: {
    minHeight: 38,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: Palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  prepareLabel: { color: Palette.parisBlue, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800' },
  inlineError: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    color: Palette.copper,
    fontFamily: Fonts.sans,
    fontSize: 10,
  },
  settingsLink: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  validationBanner: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    backgroundColor: '#F7E9E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  validationText: {
    flex: 1,
    color: Palette.copper,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
  },
  webContainer: {
    flex: 1,
    marginHorizontal: Spacing.two,
    overflow: 'hidden',
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  webView: { flex: 1, backgroundColor: Palette.white },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  loadingText: { color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 12 },
  errorState: {
    flex: 1,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '900',
  },
  errorText: {
    marginVertical: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  safariButton: { marginTop: Spacing.two, alignSelf: 'stretch' },
  successState: {
    flex: 1,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Palette.lichen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 31,
    fontWeight: '900',
  },
  successText: {
    marginVertical: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  manualFooter: {
    minHeight: 54,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  manualText: {
    flexShrink: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
});
