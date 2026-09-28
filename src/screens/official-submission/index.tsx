import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { OfficialContributionGuide } from '@/components/official-contribution-guide';
import { OfficialIdentitySheet } from '@/components/official-identity-sheet';
import { Fonts, HitSize, Kicker, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import { useUserLocation } from '@/hooks/use-user-location';
import { archiveLinkForReferenceUri } from '@/services/bhvp-images';
import {
  historicalReferenceForFrame,
  referenceUriOf,
  validatedHistoricalReferenceUri,
} from '@/services/camera-reference';
import { isOfficialCaptureAuthorized } from '@/services/official-capture-authority';
import {
  markOfficialContributionGuideSeen,
  shouldShowOfficialContributionGuide,
} from '@/services/official-contribution-guide-storage';
import {
  buildOfficialFormUsabilityScript,
  officialChromeIsExpanded,
} from '@/services/official-form-usability';
import {
  forgetOfficialIdentity,
  loadOfficialIdentity,
  saveOfficialIdentity,
  type OfficialIdentity,
} from '@/services/official-identity';
import {
  buildOfficialFormCompactScript,
  buildOfficialFormThemeScript,
} from '@/services/official-form-theme';
import {
  buildObservatoireFileCleanupScript,
  buildObservatoireFileInjectionScript,
  type OfficialUploadFiles,
} from '@/services/official-file-injection';
import {
  didAddReadyImage,
  emptyPreparedImages,
} from '@/services/official-image-preparation';
import {
  isCurrentOfficialFileMessage,
  isCurrentOfficialPreparation,
  type OfficialPreparationRequest,
} from '@/services/official-preparation-state';
import {
  acceptsOfficialBridgeMessage,
  isAllowedOfficialNavigation,
  officialPageKind,
  shouldInjectOfficialScripts,
} from '@/services/official-navigation';
import { OFFICIAL_SUBMISSION_FIXTURE_HTML } from '@/services/official-submission-fixture';
import { isSavedCaptureAuthorized, updateCapturePreparation } from '@/services/fieldbook';
import {
  buildObservatoirePrefillScript,
  OFFICIAL_SUBMISSION_FIXTURE_ENABLED,
  OBSERVATOIRE_CONTRIBUTION_URL,
  parseOfficialBridgeMessage,
  prepareImagesForOfficialForm,
  type OfficialFormImagePreparation,
  type PreparedImages,
} from '@/services/official-submission';

// Libellés des champs que le pré-remplissage signale, dans l'ordre du formulaire.
const PREFILLED_FIELD_LABELS: [string, string][] = [
  ['address', 'Adresse'],
  ['title', 'Titre'],
  ['arrondissement', 'Arrondissement'],
  ['city', 'Ville'],
  ['captureDate', 'Date'],
  ['device', 'Appareil'],
  ['latitude', 'Position GPS'],
  ['identity', 'Nom'],
  ['email', 'E-mail'],
  ['age', 'Âge'],
  ['residenceCity', 'Commune'],
  ['country', 'Pays'],
];

function labelsForPrefilledFields(fields: string[]) {
  const present = new Set(fields);
  if (present.has('longitude')) present.add('latitude');
  return PREFILLED_FIELD_LABELS.filter(([key]) => present.has(key)).map(([, label]) => label);
}

type ThumbState = 'ready' | 'attached' | 'preparing' | 'error' | 'pending';

function thumbState(
  image: PreparedImages['current'],
  attached: boolean,
  preparing: boolean,
): ThumbState {
  if (attached) return 'attached';
  if (image.ready) return 'ready';
  if (image.error) return 'error';
  return preparing ? 'preparing' : 'pending';
}

function PreparationThumb({ uri, label, state }: { uri?: string; label: string; state: ThumbState }) {
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <SymbolView name="photo" size={18} tintColor={Palette.inkSoft} />
      )}
      <View style={styles.thumbLabel}>
        <Text style={styles.thumbLabelText}>{label}</Text>
      </View>
      <View
        style={[
          styles.thumbBadge,
          state === 'attached' || state === 'ready'
            ? styles.thumbBadgeDone
            : state === 'error'
              ? styles.thumbBadgeError
              : styles.thumbBadgePending,
        ]}>
        {state === 'preparing' ? (
          <ActivityIndicator size="small" color={Palette.white} style={styles.thumbSpinner} />
        ) : (
          <SymbolView
            name={state === 'error' ? 'exclamationmark' : state === 'pending' ? 'ellipsis' : 'checkmark'}
            size={10}
            tintColor={Palette.white}
          />
        )}
      </View>
    </View>
  );
}

/** Origine et chemin d'une URL bloquée, sans sa requête : aucune donnée de formulaire en clair. */
function describeBlockedUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return value.slice(0, 80);
  }
}

function preparationErrorLabel(error: PreparedImages['current']['error']) {
  switch (error) {
    case 'permission-denied':
      return 'Accès Photos refusé — autorisez Paris GO dans Réglages.';
    case 'missing-uri':
      return 'Fichier absent — choisissez cette image manuellement dans le formulaire.';
    case 'download-failed':
      return 'Téléchargement impossible — vérifiez le réseau puis réessayez.';
    case 'file-too-large':
      return 'Fichier supérieur à 8 Mo — choisissez une version plus légère.';
    case 'invalid-image-content':
      return 'Le contenu ne correspond pas à une image JPG ou PNG valide.';
    case 'size-check-failed':
      return 'Taille du fichier invérifiable — choisissez cette image manuellement.';
    case 'unsupported-format':
      return 'Format non pris en charge — choisissez cette image manuellement.';
    case 'untrusted-uri':
      return 'Source de photo non reconnue — reprenez la photo depuis Paris GO.';
    case 'save-failed':
      return 'Préparation du fichier impossible — réessayez ou choisissez-le manuellement.';
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

function restoredPreparation(
  value: string | undefined,
  fallbackReady = false,
): PreparedImages['current'] {
  if (!value) return { ready: fallbackReady };
  try {
    const parsed = JSON.parse(value) as PreparedImages['current'];
    return typeof parsed.ready === 'boolean' ? parsed : { ready: fallbackReady };
  } catch {
    return { ready: fallbackReady };
  }
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
  const automaticPreparationKey = useRef<string | undefined>(undefined);
  const preparationGeneration = useRef(0);
  const latestPreparationRequest = useRef<OfficialPreparationRequest | undefined>(undefined);
  const latestPreparationInFlight = useRef<number | undefined>(undefined);
  const documentGenerationRef = useRef(0);
  const [documentGeneration, setDocumentGeneration] = useState(0);
  const currentPageUrl = useRef(
    OFFICIAL_SUBMISSION_FIXTURE_ENABLED ? 'about:blank' : OBSERVATOIRE_CONTRIBUTION_URL,
  );
  const {
    id,
    frame,
    referenceUri,
    uri,
    simulated,
    currentSaved,
    captureId,
    latitude,
    longitude,
    currentPreparation,
    referencePreparation,
  } = useLocalSearchParams<{
    id: string;
    frame?: string;
    referenceUri?: string;
    uri?: string;
    simulated?: string;
    currentSaved?: string;
    captureId?: string;
    latitude?: string;
    longitude?: string;
    currentPreparation?: string;
    referencePreparation?: string;
  }>();
  const authorizationKey = JSON.stringify([id, uri, captureId]);
  const [captureAuthorization, setCaptureAuthorization] = useState<{ key: string; uri?: string }>();
  const authorizationPending = captureAuthorization?.key !== authorizationKey;
  const authorizedCurrentUri = authorizationPending ? undefined : captureAuthorization?.uri;
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const authorized = Boolean(uri && (
        isOfficialCaptureAuthorized(id, uri) ||
        (captureId && await isSavedCaptureAuthorized(captureId, id, uri))
      ));
      if (!cancelled) setCaptureAuthorization({ key: authorizationKey, uri: authorized ? uri : undefined });
    };
    void check().catch(() => {
      if (!cancelled) setCaptureAuthorization({ key: authorizationKey });
    });
    return () => { cancelled = true; };
  }, [authorizationKey, captureId, id, uri]);
  const { detail } = useStationDetail(id);
  const isArchiveSector = detail?.kind === 'archive-1970';
  const { images: archiveImages } = useBhvpImages(
    isArchiveSector ? detail?.archiveLinks : undefined,
  );
  const requestedFrame = Number.parseInt(frame ?? '0', 10);
  const stationImages = archiveImages.length > 0 ? archiveImages : detail?.images ?? [];
  const historicalReference = historicalReferenceForFrame({
    images: stationImages,
    recaptureImage: detail?.recaptureImage,
    referenceImage: detail?.referenceImage,
    requestedFrame,
  });
  const resolvedReferenceUri = referenceUriOf(historicalReference.image);
  const trustedReferenceUri =
    validatedHistoricalReferenceUri({
      candidateUri: referenceUri,
      images: stationImages,
      recaptureImage: detail?.recaptureImage,
      referenceImage: detail?.referenceImage,
    }) ?? resolvedReferenceUri;
  const referenceArchiveLink = archiveLinkForReferenceUri(
    trustedReferenceUri,
    detail?.referenceImage ? [detail.referenceImage, ...stationImages] : stationImages,
  );
  const isSimulated = simulated !== '0';
  const hasSavedCoordinate =
    Boolean(latitude && longitude) &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));
  const { coordinate, isPrecise, loading: locating, error: locationError, locate } =
    useUserLocation();
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string>();
  const [webKey, setWebKey] = useState(0);
  const [prefilledCount, setPrefilledCount] = useState(0);
  const [validationMessage, setValidationMessage] = useState<string>();
  const [submissionStatus, setSubmissionStatus] = useState<'editing' | 'success'>('editing');
  const [preparingImages, setPreparingImages] = useState(false);
  const [imagePreparation, setImagePreparation] = useState<OfficialFormImagePreparation>({
    files: {},
    images: {
      current: restoredPreparation(currentPreparation, currentSaved === '1'),
      reference: restoredPreparation(referencePreparation),
    },
    sources: {},
  });
  const preparedImages = imagePreparation.images;
  const [attachedFileCount, setAttachedFileCount] = useState(0);
  const [imageError, setImageError] = useState<string>();
  // Repliée d'emblée : le formulaire a besoin de la hauteur. Elle se déplie d'elle-même en cas
  // d'erreur (`officialChromeIsExpanded`).
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [prefilledFields, setPrefilledFields] = useState<string[]>([]);
  // Les champs déjà remplis sont repliés dans le formulaire : l'écran natif en montre la valeur.
  const [showAllFields, setShowAllFields] = useState(false);
  // Identité mémorisée sur l'appareil, à la demande de l'utilisateur uniquement.
  const [identity, setIdentity] = useState<OfficialIdentity>();
  const [identitySheetVisible, setIdentitySheetVisible] = useState(false);
  useEffect(() => {
    let active = true;
    void loadOfficialIdentity().then((stored) => {
      if (active) setIdentity(stored);
    });
    return () => {
      active = false;
    };
  }, []);
  const [guideVisible, setGuideVisible] = useState(false);

  useEffect(() => {
    if (!isSimulated && !hasSavedCoordinate) void locate();
  }, [hasSavedCoordinate, isSimulated, locate]);

  useEffect(() => {
    let active = true;
    void shouldShowOfficialContributionGuide().then((shouldShow) => {
      if (active && shouldShow) setGuideVisible(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const prefill = useMemo(() => {
    const exactStationCoordinate = detail && !detail.approximate ? detail.coordinate : undefined;
    const savedLatitude = Number(latitude);
    const savedLongitude = Number(longitude);
    const savedCoordinate =
      Number.isFinite(savedLatitude) && Number.isFinite(savedLongitude) && latitude && longitude
        ? { latitude: savedLatitude, longitude: savedLongitude }
        : undefined;
    const submissionCoordinate = savedCoordinate ?? (isPrecise ? coordinate : exactStationCoordinate);
    return {
      address: detail && !detail.approximate ? detail.address : undefined,
      captureDate: localIsoDate(),
      city: 'Paris',
      device: Device.modelName ?? Device.deviceName ?? 'Smartphone',
      latitude: submissionCoordinate?.latitude,
      longitude: submissionCoordinate?.longitude,
      postalCode: postalCodeFrom(detail?.address, detail?.arrondissement),
      identity,
    };
  }, [coordinate, detail, identity, isPrecise, latitude, longitude]);
  const compactFields = !showAllFields && !validationMessage;
  useEffect(() => {
    if (shouldInjectOfficialScripts(currentPageUrl.current, OFFICIAL_SUBMISSION_FIXTURE_ENABLED)) {
      webViewRef.current?.injectJavaScript(buildOfficialFormCompactScript(compactFields));
    }
  }, [compactFields]);
  const buildInjectedScript = useCallback(
    (currentDocumentGeneration: number) => {
      const { current, reference } = imagePreparation.files;
      const fileScript =
        current && reference && imagePreparation.preparationId
          ? buildObservatoireFileInjectionScript(
              { current, reference } as OfficialUploadFiles,
              imagePreparation.preparationId,
              String(currentDocumentGeneration),
            )
          : '';
      return `${buildObservatoirePrefillScript(prefill)}\n${fileScript}\n${buildOfficialFormUsabilityScript()}\n${buildOfficialFormThemeScript()}`;
    },
    [imagePreparation.files, imagePreparation.preparationId, prefill],
  );
  const injectedScript = useMemo(
    () => buildInjectedScript(documentGeneration),
    [buildInjectedScript, documentGeneration],
  );
  const webSource = useMemo(
    () =>
      OFFICIAL_SUBMISSION_FIXTURE_ENABLED
        ? { html: OFFICIAL_SUBMISSION_FIXTURE_HTML }
        : { uri: OBSERVATOIRE_CONTRIBUTION_URL },
    [],
  );

  useEffect(() => {
    if (
      !loading &&
      shouldInjectOfficialScripts(currentPageUrl.current, OFFICIAL_SUBMISSION_FIXTURE_ENABLED)
    ) {
      webViewRef.current?.injectJavaScript(injectedScript);
    }
  }, [injectedScript, loading]);

  const blockPopup = useCallback(() => undefined, []);
  const completeGuide = useCallback(() => {
    setGuideVisible(false);
    void markOfficialContributionGuideSeen();
  }, []);

  const retry = () => {
    setFormError(undefined);
    setLoading(true);
    setWebKey((key) => key + 1);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    if (!acceptsOfficialBridgeMessage(currentPageUrl.current, OFFICIAL_SUBMISSION_FIXTURE_ENABLED)) {
      return;
    }
    const message = parseOfficialBridgeMessage(event.nativeEvent.data);
    if (!message) return;
    if (
      (message.type === 'files-ready' || message.type === 'files-error') &&
      !isCurrentOfficialFileMessage(
        message,
        latestPreparationRequest.current,
        documentGenerationRef.current,
      )
    ) {
      return;
    }
    if (message.type === 'prefill') {
      setPrefilledCount(message.count);
      setPrefilledFields(message.fields);
    }
    if (message.type === 'files-ready') {
      setAttachedFileCount(message.count);
      setImageError(undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (message.type === 'files-error') {
      setAttachedFileCount(0);
      setImageError(message.message);
    }
    if (message.type === 'success') {
      setSubmissionStatus('success');
      setImagePreparation((value) => ({
        ...value,
        files: {},
        preparationId: undefined,
        sources: {},
      }));
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
    currentPageUrl.current = navigation.url;
    if (officialPageKind(navigation.url) === 'success') {
      setSubmissionStatus('success');
      setImagePreparation((value) => ({
        ...value,
        files: {},
        preparationId: undefined,
        sources: {},
      }));
    }
  };

  const prepareImages = useCallback(async (requestInput?: unknown) => {
    const explicitRequest =
      requestInput &&
      typeof requestInput === 'object' &&
      typeof (requestInput as Partial<OfficialPreparationRequest>).generation === 'number' &&
      typeof (requestInput as Partial<OfficialPreparationRequest>).key === 'string'
        ? (requestInput as OfficialPreparationRequest)
        : undefined;
    if (!explicitRequest && latestPreparationInFlight.current !== undefined) return;
    const request = explicitRequest ?? {
      generation: ++preparationGeneration.current,
      key: `${id}|${uri}|${trustedReferenceUri}`,
    };
    if (!explicitRequest) latestPreparationRequest.current = request;
    latestPreparationInFlight.current = request.generation;
    if (isSimulated) {
      setImageError('Mode démo : utilisez le formulaire de test sans photo personnelle.');
      latestPreparationInFlight.current = undefined;
      return;
    }
    const previous = imagePreparation;
    setPreparingImages(true);
    setImageError(undefined);
    try {
      const result = await prepareImagesForOfficialForm({
        currentAuthorized: Boolean(uri && uri === authorizedCurrentUri),
        currentUri: uri,
        preparationId: String(request.generation),
        previous,
        referenceArchiveLink,
        referenceUri: trustedReferenceUri,
        stationId: id,
      });
      if (!isCurrentOfficialPreparation(request, latestPreparationRequest.current)) return;
      setImagePreparation(result);
      if (captureId && uri === authorizedCurrentUri) {
        await updateCapturePreparation(captureId, result.images).catch(() => undefined);
      }
      if (didAddReadyImage(previous.images, result.images)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (!result.files.current || !result.files.reference) {
        setAttachedFileCount(0);
      }
    } catch {
      if (isCurrentOfficialPreparation(request, latestPreparationRequest.current)) {
        setImageError('La préparation a été interrompue. Les fichiers déjà prêts restent disponibles.');
      }
    } finally {
      if (latestPreparationInFlight.current === request.generation) {
        latestPreparationInFlight.current = undefined;
      }
      setPreparingImages(latestPreparationInFlight.current !== undefined);
    }
  }, [
    authorizedCurrentUri,
    captureId,
    id,
    imagePreparation,
    isSimulated,
    referenceArchiveLink,
    trustedReferenceUri,
    uri,
  ]);

  useEffect(() => {
    if (authorizationPending) return;
    const key = `${id}|${isSimulated ? 'simulated' : 'live'}|${uri ?? ''}|${trustedReferenceUri ?? ''}`;
    if (automaticPreparationKey.current === key) return;
    automaticPreparationKey.current = key;
    preparationGeneration.current += 1;
    const request: OfficialPreparationRequest = {
      generation: preparationGeneration.current,
      key,
    };
    latestPreparationRequest.current = request;
    latestPreparationInFlight.current = undefined;
    setPreparingImages(false);
    setImageError(undefined);
    setImagePreparation((value) => ({
      ...value,
      files: {},
      images: emptyPreparedImages(),
      preparationId: undefined,
      sources: {},
    }));
    setAttachedFileCount(0);
    if (shouldInjectOfficialScripts(currentPageUrl.current, OFFICIAL_SUBMISSION_FIXTURE_ENABLED)) {
      webViewRef.current?.injectJavaScript(
        buildObservatoireFileCleanupScript(String(request.generation)),
      );
    }
    if (isSimulated || !uri || !trustedReferenceUri) return;
    void prepareImages(request);
  }, [authorizationPending, id, isSimulated, prepareImages, trustedReferenceUri, uri]);

  const allowNavigation = (request: { url: string; isTopFrame?: boolean }) => {
    const allowed = isAllowedOfficialNavigation(request.url, OFFICIAL_SUBMISSION_FIXTURE_ENABLED);
    if (!allowed && request.isTopFrame !== false) {
      // Une page hors du formulaire reste bloquée ici, jamais confiée à Safari : on le dit, et on
      // garde sa destination dans les journaux de développement pour pouvoir l'examiner.
      if (__DEV__) console.warn('[dépôt officiel] navigation bloquée :', describeBlockedUrl(request.url));
      setValidationMessage('Ce lien mène hors du formulaire officiel ; il ne s’ouvre pas dans Paris GO.');
    }
    return allowed;
  };

  const preparedCount =
    Number(preparedImages.reference.ready) + Number(preparedImages.current.ready);
  const hasPreparationError = Boolean(
    preparedImages.current.error || preparedImages.reference.error,
  );
  const prefilledLabels = labelsForPrefilledFields(prefilledFields);
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
              {OFFICIAL_SUBMISSION_FIXTURE_ENABLED ? 'Test local' : 'Observatoire de Paris'}
            </Text>
            <Text style={styles.headerTitle}>Déposer ma reprise</Text>
          </View>
          <Pressable
            accessibilityLabel="Comprendre le dépôt"
            accessibilityRole="button"
            onPress={() => setGuideVisible(true)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <SymbolView name="questionmark.circle.fill" size={19} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>
      </SafeAreaView>

      {submissionStatus !== 'success' && !formError ? (
        <View style={styles.summary}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={chromeExpanded ? 'Réduire le récapitulatif' : 'Afficher le récapitulatif'}
            accessibilityState={{ expanded: chromeExpanded }}
            onPress={() => {
              void Haptics.selectionAsync();
              setDetailsExpanded(!chromeExpanded);
            }}
            style={styles.summaryHead}>
            <View style={styles.thumbs}>
              <PreparationThumb
                uri={trustedReferenceUri}
                label="1970"
                state={thumbState(preparedImages.reference, attachedFileCount === 2, preparingImages)}
              />
              <PreparationThumb
                uri={isSimulated ? undefined : authorizedCurrentUri}
                label="2026"
                state={thumbState(preparedImages.current, attachedFileCount === 2, preparingImages)}
              />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>
                {isSimulated
                  ? 'Aperçu de démonstration'
                  : attachedFileCount === 2
                    ? 'Prêt, il ne reste que vous'
                    : preparingImages
                      ? 'Préparation des photos…'
                      : `${preparedCount}/2 photo${preparedCount > 1 ? 's' : ''} préparée${preparedCount > 1 ? 's' : ''}`}
              </Text>
              <Text style={styles.summaryMeta} numberOfLines={1}>
                {chromeExpanded
                  ? `${attachedFileCount}/2 photos jointes · ${prefilledCount} champ${prefilledCount > 1 ? 's' : ''} rempli${prefilledCount > 1 ? 's' : ''}`
                  : `${attachedFileCount}/2 photos · ${prefilledCount} champs · à vous : ${identity ? 'règlement et envoi' : 'identité et envoi'}`}
              </Text>
            </View>
            <SymbolView
              name={chromeExpanded ? 'chevron.up' : 'chevron.down'}
              size={13}
              tintColor={Palette.inkSoft}
            />
          </Pressable>

          {chromeExpanded ? (
            <View style={styles.summaryBody}>
              {prefilledLabels.length ? (
                <View style={styles.chips}>
                  {prefilledLabels.map((label) => (
                    <View key={label} style={styles.chip}>
                      <SymbolView name="checkmark" size={11} tintColor={Palette.lichen} />
                      <Text style={styles.chipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {locating ? (
                <Text style={styles.summaryMeta}>Recherche de votre position…</Text>
              ) : locationError && !isPrecise ? (
                <Text style={styles.summaryMeta}>{locationError}</Text>
              ) : null}

              {!preparedImages.current.ready && preparedImages.current.error ? (
                <Text style={styles.fileError}>
                  Photo 2026 : {preparationErrorLabel(preparedImages.current.error)}
                </Text>
              ) : null}
              {!preparedImages.reference.ready && preparedImages.reference.error ? (
                <Text style={styles.fileError}>
                  Archive : {preparationErrorLabel(preparedImages.reference.error)}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityHint="Mémorise vos informations sur cet appareil pour préremplir le formulaire"
                onPress={() => setIdentitySheetVisible(true)}
                style={({ pressed }) => [styles.identityRow, pressed && styles.pressed]}>
                <SymbolView
                  name={identity ? 'person.crop.circle.badge.checkmark' : 'person.crop.circle.badge.plus'}
                  size={20}
                  tintColor={identity ? Palette.lichen : Palette.parisBlue}
                />
                <View style={styles.identityCopy}>
                  <Text style={styles.identityTitle}>
                    {identity ? identity.fullName : 'Mémoriser mes informations'}
                  </Text>
                  <Text style={styles.identityMeta} numberOfLines={1}>
                    {identity ? `${identity.email} · sur cet appareil` : 'Nom et e-mail préremplis la prochaine fois'}
                  </Text>
                </View>
                <Text style={styles.identityAction}>{identity ? 'Modifier' : 'Ajouter'}</Text>
              </Pressable>

              <View style={styles.todo}>
                <SymbolView name="hand.tap.fill" size={15} tintColor={Palette.go} />
                <Text style={styles.todoText}>
                  <Text style={styles.todoStrong}>À vous : </Text>
                  {identity
                    ? 'vérifier vos informations, cocher le règlement, puis Envoyer.'
                    : 'nom, e-mail, règlement, puis Envoyer, dans le formulaire ci-dessous.'}
                </Text>
              </View>
              <View style={styles.todo}>
                <SymbolView name="lock.fill" size={13} tintColor={Palette.lichen} />
                <Text style={styles.trustText}>
                  {OFFICIAL_SUBMISSION_FIXTURE_ENABLED
                    ? 'Formulaire de test embarqué : aucune donnée ni photo ne quitte cet appareil.'
                    : 'Les deux photos sont ajoutées automatiquement. Votre identité, le règlement et l’envoi final restent sous votre contrôle ; Paris GO ne reçoit rien.'}
                </Text>
              </View>

              <View style={styles.summaryActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setShowAllFields((value) => !value);
                  }}
                  style={({ pressed }) => [styles.summaryAction, pressed && styles.pressed]}>
                  <SymbolView
                    name={showAllFields ? 'eye.slash' : 'list.bullet.rectangle'}
                    size={15}
                    tintColor={Palette.parisBlue}
                  />
                  <Text style={styles.summaryActionText}>
                    {showAllFields ? 'Masquer les champs remplis' : 'Voir tous les champs'}
                  </Text>
                </Pressable>
                {hasPreparationError || (!isSimulated && preparedCount < 2 && !preparingImages) ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={preparingImages}
                    onPress={prepareImages}
                    style={({ pressed }) => [styles.summaryAction, pressed && styles.pressed]}>
                    <SymbolView name="arrow.clockwise" size={14} tintColor={Palette.parisBlue} />
                    <Text style={styles.summaryActionText}>
                      {hasPreparationError ? 'Réessayer les photos' : 'Préparer les photos'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {imageError ? <Text style={styles.inlineError}>{imageError}</Text> : null}
      {validationMessage ? (
        <View style={styles.validationBanner}>
          <SymbolView name="exclamationmark.circle.fill" size={15} tintColor={Palette.go} />
          <Text numberOfLines={3} style={styles.validationText}>
            {validationMessage}
          </Text>
          <Pressable
            accessibilityLabel="Fermer l’avertissement"
            hitSlop={10}
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
                ? 'Les champs publics et les deux photos automatiques ont été vérifiés. Aucune contribution n’a été envoyée.'
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
          </View>
        ) : (
          <>
            <WebView
              key={webKey}
              ref={webViewRef}
              source={webSource}
              // `originWhitelist` confie au système (Safari) toute origine non listée, avant même
              // `onShouldStartLoadWithRequest`. Tout passe donc par `allowNavigation`, seule frontière.
              originWhitelist={['*']}
              allowsBackForwardNavigationGestures
              allowsInlineMediaPlayback
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled={false}
              onLoadStart={(event) => {
                documentGenerationRef.current += 1;
                setDocumentGeneration(documentGenerationRef.current);
                currentPageUrl.current = event.nativeEvent.url;
                setLoading(true);
                setFormError(undefined);
                setValidationMessage(undefined);
                setPrefilledCount(0);
                setPrefilledFields([]);
                setAttachedFileCount(0);
              }}
              onLoadEnd={(event) => {
                currentPageUrl.current = event.nativeEvent.url;
                setLoading(false);
                if (
                  shouldInjectOfficialScripts(
                    event.nativeEvent.url,
                    OFFICIAL_SUBMISSION_FIXTURE_ENABLED,
                  )
                ) {
                  webViewRef.current?.injectJavaScript(
                    buildInjectedScript(documentGenerationRef.current),
                  );
                  webViewRef.current?.injectJavaScript(buildOfficialFormCompactScript(compactFields));
                }
              }}
              onMessage={onMessage}
              onNavigationStateChange={onNavigationChange}
              onOpenWindow={blockPopup}
              onShouldStartLoadWithRequest={allowNavigation}
              onError={() => {
                setLoading(false);
                setFormError(
                  'Le serveur officiel de l’Observatoire ne répond pas. Ce problème est extérieur à vos photos et à Paris GO.',
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

      <SafeAreaView edges={['bottom']} style={styles.bottomInset} />
      <OfficialIdentitySheet
        visible={identitySheetVisible}
        initial={identity}
        onClose={() => setIdentitySheetVisible(false)}
        onSave={(next) => {
          setIdentity(next);
          setIdentitySheetVisible(false);
          void saveOfficialIdentity(next);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        onForget={() => {
          setIdentity(undefined);
          setIdentitySheetVisible(false);
          void forgetOfficialIdentity();
        }}
      />
      <OfficialContributionGuide onComplete={completeGuide} visible={guideVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    marginHorizontal: Spacing.two,
    marginTop: Spacing.two,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  summaryHead: {
    minHeight: 64,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  thumbs: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.small,
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    paddingHorizontal: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
  },
  thumbLabelText: {
    ...Kicker,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.2,
    color: Palette.white,
  },
  thumbBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBadgeDone: { backgroundColor: Palette.lichen },
  thumbBadgeError: { backgroundColor: Palette.go },
  thumbBadgePending: { backgroundColor: 'rgba(8, 17, 22, 0.55)' },
  thumbSpinner: { transform: [{ scale: 0.6 }] },
  summaryCopy: { flex: 1, gap: 2 },
  summaryTitle: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  summaryMeta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  summaryBody: {
    paddingHorizontal: Spacing.twoHalf,
    paddingBottom: Spacing.twoHalf,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.line,
    paddingTop: Spacing.twoHalf,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    minHeight: 28,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Palette.fog,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: { ...Typography.caption, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '600' },
  fileError: { ...Typography.caption, color: Palette.go, fontFamily: Fonts.sans, fontWeight: '600' },
  identityRow: {
    minHeight: 56,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.medium,
    backgroundColor: Palette.fog,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  identityCopy: { flex: 1, gap: 1 },
  identityTitle: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  identityMeta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  identityAction: { ...Typography.caption, color: Palette.go, fontFamily: Fonts.sans, fontWeight: '700' },
  todo: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  todoText: { ...Typography.caption, flex: 1, color: Palette.ink, fontFamily: Fonts.sans },
  todoStrong: { fontWeight: '700', color: Palette.go },
  trustText: { ...Typography.caption, flex: 1, color: Palette.inkSoft, fontFamily: Fonts.sans },
  summaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  summaryAction: {
    minHeight: HitSize,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  summaryActionText: { ...Typography.caption, color: Palette.parisBlue, fontFamily: Fonts.sans, fontWeight: '700' },
  bottomInset: { backgroundColor: Palette.fog },
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
    width: HitSize,
    height: HitSize,
    borderRadius: HitSize / 2,
    backgroundColor: Palette.fog,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerKicker: {
    ...Kicker,
    fontSize: 13,
    lineHeight: 18,
    color: Palette.go,
  },
  headerTitle: {
    marginTop: 2,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: '700',
  },
  inlineError: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    color: Palette.go,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  settingsLink: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  validationBanner: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    backgroundColor: Palette.goSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  validationText: {
    flex: 1,
    color: Palette.go,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
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
  loadingText: { color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18 },
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
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
});
