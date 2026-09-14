import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { ArchiveContactSheet } from '@/components/archive-contact-sheet';
import { GlassSurface } from '@/components/glass-surface';
import { MapPreviewSheet } from '@/components/map-preview-sheet';
import { Fonts, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';

import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';

import { useUserLocation } from '@/hooks/use-user-location';
import { useFeaturedMission, useStations } from '@/providers/stations-provider';
import {
  PARIS_INITIAL_REGION,
  classifyLocationContext,
  updateReturnToParisVisibility,
} from '@/services/location-context';
import type { Coordinate, StationSummary } from '@/types/station';
import { distanceInMeters, formatDistance } from '@/utils/distance';
import { retainExplicitMapSelection } from '@/utils/map-selection';
import { cellPlaceName, nearestArrondissement } from '@/utils/place-name';
import {
  mappingStatus,
  stationMatchesFilter,
  type CoverageCell,
  type MapFilter,
  cellsWithinViewport,
} from '@/utils/mapping-coverage';

const POINT_ZOOM_THRESHOLD = 0.047;
// Largeur de la zone de fondu, de part et d'autre du seuil : sous l'ancien seuil unique, la
// carte basculait des carrés aux points d'un coup de zoom à l'autre. Dans cette bande, les deux
// représentations se superposent avec une opacité proportionnelle à l'avancement du zoom.
const GRID_FADE_BUFFER = 0.014;
const FOCUSED_CELL_ZOOM_PADDING = 2.6;
const MAP_BOTTOM_OVERLAY_OFFSET = 110;
// Barre de recherche + rangée de filtres. Le pourcentage global vit désormais dans la barre de
// recherche : il n'ajoute plus de hauteur à réserver au-dessus de la carte.
const MAP_TOP_CONTROLS_HEIGHT = 50 + 36 + Spacing.two;
// Les photos de 2022 sont des points de vue qui restent à reprendre : elles rejoignent
// « à retrouver » plutôt que d'occuper un filtre à part.
const FILTERS: { value: MapFilter; label: string }[] = [
  { value: 'to-reprise', label: 'À retrouver' },
  { value: 'published-reprise', label: 'Photos refaites' },
];

function pinColor(station: StationSummary) {
  const status = mappingStatus(station);
  if (status === 'published-reprise') return Palette.lichen;
  if (status === 'collection-2022') return Palette.parisBlue;
  return Palette.copper;
}

function pinLabel(station: StationSummary) {
  if (station.kind === 'archive-1970') {
    if ((station.remainingCount ?? 1) === 0) return 'SECTEUR COMPLÉTÉ';
    if ((station.publishedCount ?? 0) > 0) return 'À CONTINUER';
    return 'À LOCALISER';
  }
  const status = mappingStatus(station);
  if (status === 'published-reprise') return 'PHOTO REFAITE';
  if (status === 'collection-2022') return 'PHOTO DE 2022';
  return 'PHOTO À REFAIRE';
}

// Une photo de 2022 est, comme une vue de 1970 non refaite, un point de vue qui reste à
// reprendre : les deux comptent pour « à retrouver ».
function cellRemainingCount(cell: CoverageCell) {
  return cell.remaining1970 + cell.collection2022;
}

function cellHasFilter(cell: CoverageCell, filter: MapFilter) {
  if (filter === 'to-reprise') return cellRemainingCount(cell) > 0;
  return cell.published1970 > 0;
}

function cellFill(cell: CoverageCell, filter: MapFilter) {
  if (!cellHasFilter(cell, filter)) return 'rgba(22, 63, 91, 0.025)';

  if (filter === 'to-reprise') {
    return `rgba(185, 95, 62, ${Math.min(0.68, 0.2 + cellRemainingCount(cell) * 0.025)})`;
  }
  return `rgba(112, 137, 124, ${Math.min(0.78, 0.2 + cell.published1970 * 0.03)})`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

function remainingLabel(count: number) {
  return count === 0
    ? 'Toutes les photos ont été refaites'
    : `${plural(count, 'photo')} ${count > 1 ? 'restent' : 'reste'} à retrouver`;
}

function selectionTitle(cell: CoverageCell, filter: MapFilter) {
  if (filter === 'to-reprise') return remainingLabel(cellRemainingCount(cell));
  return `${plural(cell.published1970, 'photo')} ${cell.published1970 > 1 ? 'refaites' : 'refaite'}`;
}

function emptySearchTitle(filter: MapFilter) {
  return filter === 'to-reprise' ? 'Aucune photo à retrouver ici' : 'Aucune photo refaite ici';
}

function emptySearchCopy(filter: MapFilter, query: string) {
  if (filter === 'to-reprise') {
    return `« ${query} » ne contient plus de mission ouverte. Consultez les photos refaites pour voir le résultat.`;
  }
  return `Aucune photo refaite ne correspond à « ${query} ». Essayez le filtre À retrouver.`;
}

function focusedCellColors(filter: MapFilter) {
  if (filter === 'published-reprise') {
    return { fill: 'rgba(112, 137, 124, 0.2)', stroke: Palette.lichen };
  }
  return { fill: 'rgba(185, 95, 62, 0.14)', stroke: Palette.copper };
}

function stationIsInCell(station: StationSummary, cell: CoverageCell) {
  const south = cell.coordinates[0].latitude;
  const north = cell.coordinates[1].latitude;
  const west = cell.coordinates[0].longitude;
  const east = cell.coordinates[2].longitude;
  return (
    station.coordinate.latitude >= south &&
    station.coordinate.latitude <= north &&
    station.coordinate.longitude >= west &&
    station.coordinate.longitude <= east
  );
}

/** Assombrit ou éclaircit une couleur `rgba(...)` sans changer sa teinte, pour le fondu au zoom. */
function scaleAlpha(rgba: string, factor: number) {
  const match = rgba.match(/^rgba\(([^)]+)\)$/);
  if (!match) return rgba;
  const [r, g, b, a = '1'] = match[1].split(',').map((part) => part.trim());
  return `rgba(${r}, ${g}, ${b}, ${Number(a) * factor})`;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function searchStationScore(station: StationSummary, query: string) {
  const name = normalizeSearchValue(station.name);
  const arrondissement = normalizeSearchValue(station.arrondissement ?? '');
  const status = normalizeSearchValue(pinLabel(station));
  const kindAliases =
    station.kind === 'archive-1970'
      ? 'carre secteur archives'
      : station.kind === 'station-2022'
        ? 'photo de 2022 point de vue'
        : 'photo refaite publiée';
  const searchable = `${name} ${arrondissement} ${status} ${kindAliases} ${station.year} ${station.id}`;
  const tokens = query.split(' ').filter(Boolean);

  if (!tokens.every((token) => searchable.includes(token))) return undefined;
  if (name === query) return 0;
  if (name.startsWith(query)) return 10 + name.length * 0.001;
  if (name.includes(query)) return 20 + name.indexOf(query) * 0.01;
  if (arrondissement === query) return 30;
  if (arrondissement.startsWith(query)) return 35;
  return 50 + searchable.indexOf(tokens[0]) * 0.01;
}

function MapPhotoPreview({
  station,
  index,
  total,
  width,
  height,
  meta,
  onOpen,
}: {
  station: StationSummary;
  index: number;
  total: number;
  width: number;
  height: number;
  meta: string;
  onOpen: () => void;
}) {
  const { detail } = useStationDetail(station.id);
  const isArchiveSector = station.kind === 'archive-1970';
  const { images: archiveImages, loading: archiveImagesLoading } = useBhvpImages(
    isArchiveSector ? detail?.archiveLinks : undefined,
    3,
  );
  const image = detail?.referenceImage ?? detail?.images[0] ?? station.previewImage;
  // `??` ne se replie que sur null/undefined : un tableau d'images vide donnait `0` et
  // l'encart annonçait « 0 VUE » pour un carré qui en contient plusieurs.
  const frameCount = detail?.images.length || station.frameCount || 1;

  return (
    <Pressable
      accessibilityHint="Ouvre la photographie en grand et permet de contribuer"
      accessibilityLabel={`${isArchiveSector ? 'Explorer' : 'Ouvrir'} ${station.name}, ${pinLabel(station)}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.photoPreviewCard,
        { width, height },
        pressed && styles.photoPreviewPressed,
      ]}>
      {isArchiveSector && archiveImages.length ? (
        <ArchiveContactSheet images={archiveImages} />
      ) : image ? (
        <AdaptivePhoto
          source={image}
          transition={220}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.photoPreviewFallback}>
          <View style={styles.photoPreviewFallbackIcon}>
            <SymbolView name="photo.stack" size={26} tintColor={Palette.copper} />
          </View>
          <View>
            <Text style={styles.photoPreviewFallbackTitle}>
              {archiveImagesLoading
                ? 'Ouverture des aperçus…'
                : `${frameCount} ${frameCount > 1 ? 'photos de 1970' : 'photo de 1970'}`}
            </Text>
            <Text style={styles.photoPreviewFallbackCopy}>
              {archiveImagesLoading
                ? 'Chargement depuis la Bibliothèque historique de la Ville de Paris.'
                : 'À découvrir sur le portail des bibliothèques de Paris.'}
            </Text>
          </View>
        </View>
      )}

      <View pointerEvents="none" style={styles.photoPreviewShade} />

      <View style={styles.photoPreviewTop}>
        {isArchiveSector ? (
          <View />
        ) : (
          <View style={[styles.photoStatus, { backgroundColor: pinColor(station) }]}>
            <Text style={styles.photoStatusText}>
              {`${station.year}${detail?.hasRecapture ? ' → 2026' : ''}`}
            </Text>
          </View>
        )}
        <View style={styles.photoCounter}>
          {!isArchiveSector ? (
            <SymbolView
              name="arrow.left.and.right"
              size={12}
              tintColor={Palette.white}
            />
          ) : null}
          <Text style={styles.photoCounterText}>
            {isArchiveSector
              ? `${frameCount} ${frameCount > 1 ? 'PHOTOS' : 'PHOTO'}`
              : `${index + 1}/${total}`}
          </Text>
        </View>
      </View>

      <View style={styles.photoPreviewBody}>
        {isArchiveSector ? null : (
          <Text style={styles.photoPreviewKicker}>{pinLabel(station)}</Text>
        )}
        <Text style={styles.photoPreviewTitle} numberOfLines={2}>
          {isArchiveSector ? 'Choisir une photo' : station.name}
        </Text>
        <View style={styles.photoPreviewMetaRow}>
          <Text style={styles.photoPreviewMeta} numberOfLines={1}>
            {isArchiveSector ? `${plural(frameCount, 'vue')} d’archive` : meta}
          </Text>
          <View style={styles.photoPreviewAction}>
            <Text style={styles.photoPreviewActionText}>
              {isArchiveSector ? 'Voir les photos' : 'Ouvrir'}
            </Text>
            <SymbolView name="arrow.right" size={14} tintColor={Palette.white} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function MapScreen() {
  const router = useRouter();
  const { station: requestedStationId, focus: focusRequest } =
    useLocalSearchParams<{ station?: string; focus?: string }>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const carouselRef = useRef<FlatList<StationSummary>>(null);
  const handledFocusRequest = useRef<string | undefined>(undefined);
  const { stations, coverage, grid } = useStations();
  const featuredMission = useFeaturedMission();
  // La position s'affiche par défaut dès qu'elle est disponible, sans attendre un appui sur le
  // bouton de localisation — `autoLocate` respecte la préférence « manuel » déjà proposée ailleurs
  // dans l'app.
  const { coordinate, isPrecise, loading, locate } = useUserLocation({ autoLocate: true });
  const locationContext = classifyLocationContext({ coordinate, isPrecise });
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  // Les photos déjà refaites intéressent moins que celles qui restent à retrouver : c'est ce
  // filtre qui ouvre la carte, à une bascule de la vue « Photos refaites ».
  const [filter, setFilter] = useState<MapFilter>('to-reprise');
  const [region, setRegion] = useState<Region>(PARIS_INITIAL_REGION);
  const [heading, setHeading] = useState(0);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [selected, setSelected] = useState<StationSummary | undefined>();
  const [selectedCell, setSelectedCell] = useState<CoverageCell>();
  const [focusedCell, setFocusedCell] = useState<CoverageCell>();
  const [userMovedMap, setUserMovedMap] = useState(false);
  const [recenteredOutsideParis, setRecenteredOutsideParis] = useState(false);
  const [browseOrigin, setBrowseOrigin] = useState<Coordinate>({
    latitude: PARIS_INITIAL_REGION.latitude,
    longitude: PARIS_INITIAL_REGION.longitude,
  });
  const carouselCardWidth = screenWidth - Spacing.three * 2;
  const carouselStep = carouselCardWidth + Spacing.two;
  // Le carrousel couvrait plus de la moitié de la carte et empêchait de zoomer ou de naviguer
  // dessous : sa hauteur est nettement réduite par rapport à l'ancien 300-380.
  const previewCardHeight = Math.min(220, Math.max(190, screenHeight * 0.24));

  // Dessiner toutes les mailles importées, y compris hors écran, sature le rendu de la carte :
  // on ne garde que celles qui recoupent la vue,
  // avec une marge d'une demi-vue pour absorber les déplacements courts.
  const visibleGrid = useMemo(() => {
    const marginLatitude = region.latitudeDelta * 0.5;
    const marginLongitude = region.longitudeDelta * 0.5;
    return cellsWithinViewport(grid, [
      region.longitude - region.longitudeDelta / 2 - marginLongitude,
      region.latitude - region.latitudeDelta / 2 - marginLatitude,
      region.longitude + region.longitudeDelta / 2 + marginLongitude,
      region.latitude + region.latitudeDelta / 2 + marginLatitude,
    ]);
  }, [grid, region]);
  const normalizedQuery = normalizeSearchValue(query);
  const showIndividualPoints =
    Boolean(normalizedQuery) || region.latitudeDelta <= POINT_ZOOM_THRESHOLD;
  // Fondu continu entre les deux représentations : 0 = uniquement les carrés, 1 = uniquement les
  // points. Calculé sur le même seuil que `showIndividualPoints`, dans une bande symétrique
  // autour de lui, pour que la bascule ne soit plus un couperet.
  const pointsBlend = Math.min(
    1,
    Math.max(
      0,
      (POINT_ZOOM_THRESHOLD + GRID_FADE_BUFFER - region.latitudeDelta) / (2 * GRID_FADE_BUFFER),
    ),
  );
  // Les carrés de 1970 n'ont pas d'arrondissement propre : on le retrouve via le repère localisé
  // le plus proche (reprise publiée ou photo de 2022), qui lui en connaît un.
  const locatedStations = useMemo(
    () => stations.filter((station) => Boolean(station.arrondissement)),
    [stations],
  );

  const statusFilteredStations = useMemo(
    () => stations.filter((station) => stationMatchesFilter(station, filter)),
    [filter, stations],
  );

  const searchMatches = useMemo(() => {
    if (!normalizedQuery) return [];

    return stations
      .map((station) => {
        const score = searchStationScore(station, normalizedQuery);
        if (score === undefined) return undefined;
        return {
          station,
          score,
          distance: distanceInMeters(
            { latitude: region.latitude, longitude: region.longitude },
            station.coordinate,
          ),
        };
      })
      .filter(
        (
          match,
        ): match is { station: StationSummary; score: number; distance: number } =>
          Boolean(match),
      )
      .sort((left, right) => left.score - right.score || left.distance - right.distance);
  }, [
    normalizedQuery,
    region.latitude,
    region.longitude,
    stations,
  ]);

  const filteredSearchMatches = useMemo(
    () => searchMatches.filter(({ station }) => stationMatchesFilter(station, filter)),
    [filter, searchMatches],
  );
  const filteredStations = normalizedQuery
    ? filteredSearchMatches.map(({ station }) => station)
    : statusFilteredStations;
  const searchSuggestions = filteredSearchMatches.slice(0, 5);
  const hasNoFilteredSearchResults =
    Boolean(normalizedQuery) && filteredStations.length === 0;

  const popularArrondissements = useMemo(() => {
    const counts = new Map<string, number>();
    statusFilteredStations.forEach((station) => {
      if (!station.arrondissement) return;
      counts.set(station.arrondissement, (counts.get(station.arrondissement) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([arrondissement]) => arrondissement);
  }, [statusFilteredStations]);

  const visibleStations = useMemo(() => {
    const candidates = focusedCell
      ? statusFilteredStations.filter((station) => stationIsInCell(station, focusedCell))
      : filteredStations;
    const ranked = candidates
      .filter((station) => !station.approximate)
      .map((station) => ({
        station,
        distance: distanceInMeters(browseOrigin, station.coordinate),
      }))
      .sort((left, right) => left.distance - right.distance)
      .map(({ station }) => station);
    return retainExplicitMapSelection(
      ranked,
      focusedCell ? undefined : selected?.id,
      statusFilteredStations,
      80,
    );
  }, [browseOrigin, filteredStations, focusedCell, selected?.id, statusFilteredStations]);

  // La sélection initiale suit la mission mise en avant, le temps que le relevé actif se charge.
  const currentSelection = selected ?? featuredMission;
  const activeSelected =
    visibleStations.find((station) => station.id === currentSelection?.id) ??
    visibleStations[0] ??
    filteredStations.find((station) => !station.approximate) ??
    currentSelection;

  const focusedArchiveStations = useMemo(() => {
    if (!focusedCell || focusedCell.remaining1970 === 0 || filter !== 'to-reprise') {
      return [];
    }
    return stations
      .filter(
        (station) =>
          station.approximate &&
          mappingStatus(station) === 'to-reprise' &&
          stationIsInCell(station, focusedCell),
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
  }, [filter, focusedCell, stations]);

  const isExploringArchiveCell =
    Boolean(focusedCell) && focusedArchiveStations.length > 0;

  const unlocatedClusterCells = useMemo(() => {
    if (!showIndividualPoints) return [];
    if (searchFocused) return [];
    if (normalizedQuery && !focusedCell) return [];
    if (filter !== 'to-reprise') return [];
    if (focusedCell) return [];

    const latitudeRadius = region.latitudeDelta * 0.62;
    const longitudeRadius = region.longitudeDelta * 0.62;
    return grid
      .filter(
        (cell) =>
          cell.remaining1970 > 0 &&
          Math.abs(cell.center.latitude - region.latitude) <= latitudeRadius &&
          Math.abs(cell.center.longitude - region.longitude) <= longitudeRadius,
      )
      .slice(0, 24);
  }, [
    filter,
    focusedCell,
    grid,
    normalizedQuery,
    region.latitude,
    region.latitudeDelta,
    region.longitude,
    region.longitudeDelta,
    searchFocused,
    showIndividualPoints,
  ]);

  const hasSelectedExactStation =
    !activeSelected.approximate &&
    visibleStations.some((station) => station.id === activeSelected.id);
  const hasPreview = Boolean(selectedCell || focusedCell || hasNoFilteredSearchResults ||
    (showIndividualPoints && hasSelectedExactStation));

  const topOffset = Math.max(insets.top, 52) + Spacing.one;

  const setMapTarget = useCallback((mapTarget: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
    avoidBottomOverlay?: boolean;
  }) => {
    setPreviewCollapsed(false);
    const latitudeDelta = mapTarget.latitudeDelta ?? 0.018;
    const longitudeDelta = mapTarget.longitudeDelta ?? 0.014;
    const visibleMapTop = topOffset + MAP_TOP_CONTROLS_HEIGHT;
    const visibleMapBottom = screenHeight - MAP_BOTTOM_OVERLAY_OFFSET - previewCardHeight;
    const visibleMapCenter = (visibleMapTop + visibleMapBottom) / 2;
    const verticalOffsetRatio =
      mapTarget.avoidBottomOverlay && visibleMapBottom > visibleMapTop
        ? (screenHeight / 2 - visibleMapCenter) / screenHeight
        : 0;

    // Conserver la cible dans l'état : une commande impérative peut être perdue pendant
    // le montage ou la réactivation de l'onglet natif depuis une fiche photo.
    setRegion({
      latitude: mapTarget.latitude - latitudeDelta * verticalOffsetRatio,
      longitude: mapTarget.longitude,
      latitudeDelta,
      longitudeDelta,
    });
  }, [previewCardHeight, screenHeight, topOffset]);

  useEffect(() => {
    const selectedIndex = visibleStations.findIndex(
      (station) => station.id === activeSelected.id,
    );
    if (selectedIndex < 0) return;
    carouselRef.current?.scrollToOffset({
      offset: selectedIndex * carouselStep,
      animated: true,
    });
  }, [activeSelected.id, carouselStep, visibleStations]);

  const handleLocate = useCallback(async () => {
    void Haptics.selectionAsync();
    const nextCoordinate = await locate();
    if (!nextCoordinate) {
      Alert.alert(
        'Position non disponible',
        'Autorisez la position pour afficher les missions proches de vous.',
      );
      return;
    }
    setSelectedCell(undefined);
    setFocusedCell(undefined);
    setBrowseOrigin(nextCoordinate);
    setRecenteredOutsideParis(
      classifyLocationContext({ coordinate: nextCoordinate, isPrecise: true }) ===
        'outside-paris',
    );
    const nearestStation = statusFilteredStations.reduce<StationSummary | undefined>(
      (closest, station) => {
        if (station.approximate) return closest;
        if (!closest) return station;
        return distanceInMeters(nextCoordinate, station.coordinate) <
          distanceInMeters(nextCoordinate, closest.coordinate)
          ? station
          : closest;
      },
      undefined,
    );
    if (nearestStation) setSelected(nearestStation);
    setMapTarget({
      ...nextCoordinate,
      latitudeDelta: 0.025,
      longitudeDelta: 0.02,
    });
  }, [locate, setMapTarget, statusFilteredStations]);

  const handleReturnToParis = useCallback(() => {
    setSelected(undefined);
    setSelectedCell(undefined);
    setFocusedCell(undefined);
    setQuery('');
    setRecenteredOutsideParis(false);
    setBrowseOrigin({
      latitude: PARIS_INITIAL_REGION.latitude,
      longitude: PARIS_INITIAL_REGION.longitude,
    });
    setMapTarget({ ...PARIS_INITIAL_REGION });
    void Haptics.selectionAsync();
  }, [setMapTarget]);

  const handleSelect = useCallback((station: StationSummary) => {
    setPreviewCollapsed(false);
    Keyboard.dismiss();
    setSelectedCell(undefined);
    setFocusedCell(undefined);
    setSelected(station);
    void Haptics.selectionAsync();
  }, [setFocusedCell]);

  const handleChooseSearchResult = useCallback(
    (station: StationSummary) => {
      const stationCell = grid.find((cell) => stationIsInCell(station, cell));
      setSelected(station);
      setSelectedCell(undefined);
      setFocusedCell(station.approximate ? stationCell : undefined);
      setQuery(station.name);
      setSearchFocused(false);
      const target =
        station.approximate && stationCell ? stationCell.center : station.coordinate;
      setBrowseOrigin(target);
      setRecenteredOutsideParis((visible) =>
        updateReturnToParisVisibility(visible, target),
      );
      if (station.approximate && stationCell) {
        const latitudeDelta =
          Math.abs(stationCell.coordinates[1].latitude - stationCell.coordinates[0].latitude) *
          FOCUSED_CELL_ZOOM_PADDING;
        const longitudeDelta =
          Math.abs(stationCell.coordinates[2].longitude - stationCell.coordinates[1].longitude) *
          FOCUSED_CELL_ZOOM_PADDING;
        setMapTarget({
          ...target,
          latitudeDelta,
          longitudeDelta,
          avoidBottomOverlay: true,
        });
      } else {
        setMapTarget({ ...target });
      }
      Keyboard.dismiss();
      void Haptics.selectionAsync();
    },
    [grid, setMapTarget],
  );

  useEffect(() => {
    if (!requestedStationId) return;
    const requestKey = `${requestedStationId}:${focusRequest ?? ''}`;
    if (handledFocusRequest.current === requestKey) return;

    const requestedStation = stations.find(
      (station) => station.id === requestedStationId,
    );
    if (!requestedStation) return;

    const frame = requestAnimationFrame(() => {
      handledFocusRequest.current = requestKey;
      // Sans statut dédié pour rendre la station visible quel que soit son état, on choisit le
      // filtre qui la contient réellement plutôt qu'un « Tout » qui n'existe plus.
      setFilter(mappingStatus(requestedStation) === 'published-reprise' ? 'published-reprise' : 'to-reprise');
      handleChooseSearchResult(requestedStation);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    focusRequest,
    handleChooseSearchResult,
    requestedStationId,
    stations,
  ]);

  const handleGridSelect = (cell: CoverageCell) => {
    if (!cellHasFilter(cell, filter)) return;
    setPreviewCollapsed(false);
    Keyboard.dismiss();
    setFocusedCell(undefined);
    setSelectedCell(cell);
    void Haptics.selectionAsync();
  };

  const openGridCell = useCallback((cell: CoverageCell) => {
    const exactStations = filteredStations.filter(
      (station) => !station.approximate && stationIsInCell(station, cell),
    );
    const preferredStatus = filter === 'published-reprise' ? 'published-reprise' : undefined;
    const nextSelected =
      exactStations.find(
        (station) => preferredStatus && mappingStatus(station) === preferredStatus,
      ) ?? exactStations[0];
    if (nextSelected) setSelected(nextSelected);

    setSelectedCell(undefined);
    setFocusedCell(cell);
    setBrowseOrigin(cell.center);
    setRecenteredOutsideParis((visible) =>
      updateReturnToParisVisibility(visible, cell.center),
    );

    const latitudeDelta =
      Math.abs(cell.coordinates[1].latitude - cell.coordinates[0].latitude) *
      FOCUSED_CELL_ZOOM_PADDING;
    const longitudeDelta =
      Math.abs(cell.coordinates[2].longitude - cell.coordinates[1].longitude) *
      FOCUSED_CELL_ZOOM_PADDING;
    setMapTarget({
      ...cell.center,
      latitudeDelta,
      longitudeDelta,
      avoidBottomOverlay: true,
    });
  }, [filter, filteredStations, setMapTarget]);

  const handleResetNorth = useCallback(() => {
    void Haptics.selectionAsync();
    mapRef.current?.animateCamera({ heading: 0 }, { duration: 300 });
  }, []);

  const handleRegionChangeComplete = useCallback(
    (nextRegion: Region) => {
      const enteredPointView =
        region.latitudeDelta > POINT_ZOOM_THRESHOLD &&
        nextRegion.latitudeDelta <= POINT_ZOOM_THRESHOLD;
      setRegion(nextRegion);
      void mapRef.current?.getCamera().then((camera) => {
        setHeading(camera.heading);
      }).catch(() => undefined);
      setRecenteredOutsideParis((visible) =>
        updateReturnToParisVisibility(visible, nextRegion),
      );
      if (userMovedMap || enteredPointView) {
        setBrowseOrigin({
          latitude: nextRegion.latitude,
          longitude: nextRegion.longitude,
        });
      }
      if (userMovedMap) setUserMovedMap(false);
    },
    [region.latitudeDelta, userMovedMap],
  );

  const focusCarouselIndex = useCallback(
    (index: number) => {
      const station = visibleStations[index];
      if (!station || station.id === activeSelected.id) return;
      setSelectedCell(undefined);
      setSelected(station);
      setRecenteredOutsideParis((visible) =>
        updateReturnToParisVisibility(visible, station.coordinate),
      );
      setMapTarget({ ...station.coordinate });
      void Haptics.selectionAsync();
    },
    [activeSelected.id, setMapTarget, visibleStations],
  );

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        region={region}
        mapType="mutedStandard"
        showsCompass={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        pitchEnabled={showIndividualPoints}
        rotateEnabled={showIndividualPoints}
        onPanDrag={() => setUserMovedMap(true)}
        onRegionChangeComplete={handleRegionChangeComplete}>
        {pointsBlend < 1
          ? visibleGrid.map((cell) => (
              <Polygon
                key={cell.id}
                coordinates={cell.coordinates}
                fillColor={scaleAlpha(cellFill(cell, filter), 1 - pointsBlend)}
                strokeColor={
                  selectedCell?.id === cell.id
                    ? Palette.white
                    : 'rgba(22, 63, 91, 0.16)'
                }
                strokeWidth={selectedCell?.id === cell.id ? 2.4 : 0.8}
                tappable={cellHasFilter(cell, filter)}
                onPress={() => handleGridSelect(cell)}
              />
            ))
          : null}

        {!showIndividualPoints && selectedCell ? (
          <Marker coordinate={selectedCell.center} tracksViewChanges={false}>
            <View style={styles.gridMarker}>
              <Text style={styles.gridMarkerText}>{selectedCell.percentage}%</Text>
            </View>
          </Marker>
        ) : null}

        {showIndividualPoints && focusedCell ? (
          <Polygon
            coordinates={focusedCell.coordinates}
            fillColor={focusedCellColors(filter).fill}
            strokeColor={focusedCellColors(filter).stroke}
            strokeWidth={2.4}
          />
        ) : null}

        {showIndividualPoints
          ? unlocatedClusterCells.map((cell) => (
              <Marker
                key={`unlocated-${cell.id}`}
                coordinate={cell.center}
                tracksViewChanges={false}
                zIndex={6}
                onPress={() => {
                  setFocusedCell(undefined);
                  setSelectedCell(cell);
                  void Haptics.selectionAsync();
                }}>
                <View style={styles.unlocatedCluster}>
                  <Text style={styles.unlocatedCountText}>{cell.remaining1970}</Text>
                </View>
              </Marker>
            ))
          : null}

        {pointsBlend > 0
          ? visibleStations.map((station) => (
              <Marker
                key={station.id}
                coordinate={station.coordinate}
                pinColor={pinColor(station)}
                opacity={(isExploringArchiveCell ? 0.48 : 0.9) * pointsBlend}
                zIndex={
                  activeSelected.id === station.id && !isExploringArchiveCell
                    ? 50
                    : 1
                }
                onPress={() => handleSelect(station)}
              />
            ))
          : null}

        {showIndividualPoints && hasSelectedExactStation && !isExploringArchiveCell ? (
          <Marker
            coordinate={activeSelected.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tappable={false}
            tracksViewChanges={false}
            zIndex={45}>
            <View pointerEvents="none" style={styles.selectedPointHalo}>
              <View style={styles.selectedPointCore} />
            </View>
          </Marker>
        ) : null}

        {isPrecise ? (
          <Marker
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel="Votre position"
            tappable={false}
            tracksViewChanges={false}
            zIndex={1000}>
            <View pointerEvents="none" style={styles.userLocationMarker}>
              <View style={styles.userLocationHalo} />
              <View style={styles.userLocationRing}>
                <View style={styles.userLocationDot} />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View
        pointerEvents="box-none"
        style={[styles.topOverlay, { top: topOffset }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <GlassSurface variant="clear" />
            <SymbolView name="magnifyingglass" size={18} tintColor={Palette.inkSoft} />
            <TextInput
              value={query}
              onChangeText={(nextQuery) => {
                setQuery(nextQuery);
                setSelected(undefined);
                setSelectedCell(undefined);
                setFocusedCell(undefined);
              }}
              onFocus={() => setSearchFocused(true)}
              onSubmitEditing={() => {
                const firstResult = searchSuggestions[0]?.station;
                if (firstResult) handleChooseSearchResult(firstResult);
              }}
              placeholder="Une rue, un quartier, un arrondissement"
              placeholderTextColor={Palette.inkSoft}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
                <SymbolView name="xmark.circle.fill" size={18} tintColor={Palette.inkSoft} />
              </Pressable>
            ) : null}
          </View>

          {/* Le pourcentage global vivait dans un bandeau pleine largeur sous la barre de
              recherche ; il rejoint la barre elle-même, et reste le seul chemin vers /coverage. */}
          <Pressable
            accessibilityHint="Ouvre le détail des photos de 1970, de 2022 et des photos refaites aujourd’hui"
            accessibilityLabel={`${coverage.percentage}% des photos de 1970 cartographiées. Voir les statistiques`}
            accessibilityRole="button"
            onPress={() => router.push('/coverage')}
            style={({ pressed }) => [styles.coverageBadge, pressed && styles.pressed]}>
            <GlassSurface variant="clear" />
            <Text style={styles.coverageBadgeText}>{coverage.percentage}%</Text>
            <SymbolView name="chevron.right" size={11} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>

        {searchFocused ? (
          <View style={styles.searchPanel}>
            <GlassSurface />
            <View style={styles.searchPanelHeader}>
              <View>
                <Text style={styles.searchPanelKicker}>
                  {normalizedQuery
                    ? `${filteredSearchMatches.length} RÉSULTAT${filteredSearchMatches.length > 1 ? 'S' : ''}`
                    : 'RECHERCHE GUIDÉE'}
                </Text>
                <Text style={styles.searchPanelTitle}>
                  {normalizedQuery
                    ? filteredSearchMatches.length
                      ? 'Meilleures correspondances'
                      : 'Aucun repère trouvé'
                  : 'Cherchez dans toutes les archives'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setSearchFocused(false);
                }}
                style={styles.searchCloseButton}>
                <Text style={styles.searchCloseText}>Fermer</Text>
              </Pressable>
            </View>

            {normalizedQuery ? (
              searchSuggestions.length ? (
                <View style={styles.searchResults}>
                  {searchSuggestions.map(({ station }) => (
                    <Pressable
                      key={station.id}
                      accessibilityLabel={`${station.name}, ${pinLabel(station)}`}
                      onPressIn={() => handleChooseSearchResult(station)}
                      style={({ pressed }) => [
                        styles.searchResult,
                        pressed && styles.searchResultPressed,
                      ]}>
                      {station.previewImage ? (
                        <Image
                          source={station.previewImage}
                          contentFit="cover"
                          style={styles.searchResultImage}
                        />
                      ) : (
                        <View
                          style={[
                            styles.searchResultFallback,
                            { backgroundColor: pinColor(station) },
                          ]}>
                          <SymbolView
                            name={station.approximate ? 'square.grid.3x3' : 'mappin'}
                            size={17}
                            tintColor={Palette.white}
                          />
                        </View>
                      )}
                      <View style={styles.searchResultCopy}>
                        <Text style={styles.searchResultTitle} numberOfLines={1}>
                          {station.kind === 'archive-1970'
                            ? cellPlaceName({ center: station.coordinate, name: station.name }, locatedStations)
                            : station.name}
                        </Text>
                        <Text style={styles.searchResultMeta} numberOfLines={1}>
                          {pinLabel(station)} · {station.arrondissement ??
                            nearestArrondissement(station.coordinate, locatedStations) ??
                            'Paris'}
                        </Text>
                      </View>
                      <SymbolView
                        name="arrow.up.left.and.arrow.down.right"
                        size={15}
                        tintColor={Palette.parisBlue}
                      />
                    </Pressable>
                  ))}
                  {filteredSearchMatches.length > searchSuggestions.length ? (
                    <Text style={styles.searchMore}>
                      Affinez la recherche pour départager les{' '}
                      {filteredSearchMatches.length.toLocaleString('fr-FR')} résultats.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.searchEmpty}>
                  <SymbolView name="magnifyingglass" size={21} tintColor={Palette.copper} />
                  <Text style={styles.searchEmptyCopy}>
                    Essayez un numéro, un nom de rue, un code postal ou « Secteur 839 ».
                  </Text>
                </View>
              )
            ) : (
              <View>
                <Text style={styles.searchGuideCopy}>
                  Saisissez une adresse complète ou commencez par un arrondissement.
                </Text>
                <View style={styles.searchShortcuts}>
                  {popularArrondissements.map((arrondissement) => (
                    <Pressable
                      key={arrondissement}
                      onPressIn={() => setQuery(arrondissement)}
                      style={({ pressed }) => [
                        styles.searchShortcut,
                        pressed && styles.searchResultPressed,
                      ]}>
                      <SymbolView name="mappin" size={13} tintColor={Palette.parisBlue} />
                      <Text style={styles.searchShortcutText}>{arrondissement}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPressIn={() => setQuery('Secteur 839')}
                    style={({ pressed }) => [
                      styles.searchShortcut,
                      pressed && styles.searchResultPressed,
                    ]}>
                    <SymbolView name="square.grid.3x3" size={13} tintColor={Palette.parisBlue} />
                    <Text style={styles.searchShortcutText}>Secteur 839</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ) : (
          // Une bascule à deux positions tient dans la largeur de l'écran : contrairement à
          // l'ancienne rangée de pastilles, elle n'a plus besoin de défiler.
          <View style={styles.filterSegment}>
            {FILTERS.map((option) => {
              const active = filter === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    const searchedArchive = searchMatches.find(
                      ({ station }) => station.kind === 'archive-1970',
                    )?.station;
                    const searchedCell = searchedArchive
                      ? grid.find((cell) => stationIsInCell(searchedArchive, cell))
                      : undefined;
                    const contextualCell = focusedCell ?? selectedCell ?? searchedCell;

                    setFilter(option.value);
                    setSelectedCell(undefined);
                    setFocusedCell(
                      contextualCell && cellHasFilter(contextualCell, option.value)
                        ? contextualCell
                        : undefined,
                    );
                    Keyboard.dismiss();
                    void Haptics.selectionAsync();
                  }}
                  style={[
                    styles.filterSegmentOption,
                    active && styles.filterSegmentOptionActive,
                  ]}>
                  <Text
                    style={[
                      styles.filterSegmentLabel,
                      active && styles.filterSegmentLabelActive,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View
        style={[
          styles.mapControls,
          {
            bottom:
              previewCollapsed || searchFocused
                ? 126
                : isExploringArchiveCell ||
              (showIndividualPoints && hasSelectedExactStation)
                ? previewCardHeight + 126
                : selectedCell || focusedCell || hasNoFilteredSearchResults
                ? 276
                : 126,
          },
        ]}>
        {recenteredOutsideParis ? (
          <Pressable
            accessibilityLabel="Revenir à la carte de Paris"
            accessibilityRole="button"
            onPress={handleReturnToParis}
            style={({ pressed }) => [styles.returnToParisButton, pressed && styles.pressed]}>
            <SymbolView name="map" size={16} tintColor={Palette.parisBlue} />
            <Text style={styles.returnToParisText}>Revenir à Paris</Text>
          </Pressable>
        ) : null}
        <View style={styles.mapControlGroup}>
        <GlassSurface />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revenir au nord"
          accessibilityValue={{ text: `Orientation ${Math.round(heading)} degrés` }}
          onPress={handleResetNorth}
          style={({ pressed }) => [styles.mapButton, pressed && styles.mapButtonPressed]}>
          <Text style={styles.compassNorth}>N</Text>
          <View style={[styles.compassNeedle, { transform: [{ rotate: `${-heading}deg` }] }]}>
            <View style={styles.compassNeedleNorth} />
            <View style={styles.compassNeedleSouth} />
          </View>
        </Pressable>
        <View style={styles.mapControlDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={loading ? 'Recherche de votre position' : 'Utiliser ma position'}
          accessibilityState={{ disabled: loading, busy: loading }}
          onPress={handleLocate}
          disabled={loading}
          style={({ pressed }) => [styles.mapButton, pressed && styles.mapButtonPressed]}>
          {loading ? (
            <ActivityIndicator size="small" color={Palette.parisBlue} />
          ) : (
            <SymbolView
              name={isPrecise ? 'location.fill' : 'location'}
              size={22}
              tintColor={Palette.parisBlue}
            />
          )}
        </Pressable>
        </View>
      </View>

      {!searchFocused && hasPreview ? (
        <View style={styles.bottomOverlay} pointerEvents="box-none">
          <MapPreviewSheet collapsed={previewCollapsed} onCollapsedChange={setPreviewCollapsed}>
          {selectedCell ? (
            <View style={styles.gridSelectionCard}>
              <GlassSurface />
              <View style={styles.gridSelectionHeader}>
                <View style={styles.gridSelectionTextGroup}>
                  <Text style={styles.gridSelectionKicker}>
                    {filter === 'to-reprise' ? 'À RETROUVER' : 'PHOTOS REFAITES'}{' '}
                    · {cellPlaceName(selectedCell, locatedStations)} · N°{selectedCell.name}
                  </Text>
                  <Text style={styles.gridSelectionTitle}>
                    {selectionTitle(selectedCell, filter)}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={
                    showIndividualPoints
                      ? `Voir les photos du secteur ${selectedCell.name}`
                      : `Explorer le secteur ${selectedCell.name}`
                  }
                  onPress={() => openGridCell(selectedCell)}
                  style={({ pressed }) => [styles.gridOpenButton, pressed && styles.pressed]}>
                  <Text style={styles.gridOpenText}>Voir les photos</Text>
                  <SymbolView name="photo.on.rectangle" size={15} tintColor={Palette.white} />
                </Pressable>
              </View>
              <Text style={styles.gridSelectionMeta}>
                {filter === 'to-reprise'
                  ? `${plural(selectedCell.published1970, 'photo')} déjà ${selectedCell.published1970 > 1 ? 'refaites' : 'refaite'}`
                  : `${plural(selectedCell.total1970, 'photo')} dans les archives du secteur`}
              </Text>
            </View>
          ) : isExploringArchiveCell && focusedCell ? (
            // Un seul panneau : le lieu et les compteurs ne sont dits qu'ici, dans l'en-tête ;
            // les cartes du carrousel ci-dessous ne répètent plus ces chiffres. L'en-tête n'a
            // plus de hauteur figée, pour ne jamais déborder sur le carrousel quand le nom du
            // lieu passe sur deux lignes.
            <View style={styles.archiveNavigator}>
              <View style={styles.archiveNavigatorHeader}>
                <GlassSurface />
                <View style={styles.archiveRailHeading}>
                  <Text style={styles.gridSelectionKicker}>
                    ARCHIVES DE 1970 · ZONE DE 250 M
                  </Text>
                  <Text style={styles.archiveRailTitle}>
                    {cellPlaceName(focusedCell, locatedStations)}
                  </Text>
                  <Text style={styles.archiveRailMeta}>
                    {plural(focusedCell.remaining1970, 'photo')} à retrouver
                    {focusedCell.published1970 > 0
                      ? ` · ${plural(focusedCell.published1970, 'photo')} ${focusedCell.published1970 > 1 ? 'refaites' : 'refaite'}`
                      : ''}{' '}
                    · N°{focusedCell.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Fermer cette zone"
                  onPress={() => setFocusedCell(undefined)}
                  style={({ pressed }) => [
                    styles.archiveRailClose,
                    pressed && styles.pressed,
                  ]}>
                  <SymbolView name="xmark" size={13} tintColor={Palette.parisBlue} />
                </Pressable>
              </View>
              <FlatList
                horizontal
                data={focusedArchiveStations}
                keyExtractor={(station) => station.id}
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                disableIntervalMomentum
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                snapToAlignment="start"
                snapToInterval={carouselStep}
                windowSize={3}
                contentContainerStyle={[
                  styles.carouselContent,
                  { paddingRight: screenWidth - carouselCardWidth },
                ]}
                renderItem={({ item, index }) => (
                  <MapPhotoPreview
                    station={item}
                    index={index}
                    total={focusedArchiveStations.length}
                    width={carouselCardWidth}
                    height={previewCardHeight - 92}
                    meta="Paris · position exacte à retrouver"
                    onOpen={() =>
                      router.push({
                        pathname: '/station/[id]',
                        params: { id: item.id },
                      })
                    }
                  />
                )}
              />
            </View>
          ) : showIndividualPoints && hasSelectedExactStation ? (
            <FlatList
              ref={carouselRef}
              horizontal
              data={visibleStations}
              keyExtractor={(station) => station.id}
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              disableIntervalMomentum
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              snapToAlignment="start"
              snapToInterval={carouselStep}
              windowSize={3}
              contentContainerStyle={[
                styles.carouselContent,
                { paddingRight: screenWidth - carouselCardWidth },
              ]}
              getItemLayout={(_, index) => ({
                length: carouselStep,
                offset: carouselStep * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(
                  event.nativeEvent.contentOffset.x / carouselStep,
                );
                focusCarouselIndex(nextIndex);
              }}
              renderItem={({ item, index }) => (
                <MapPhotoPreview
                  station={item}
                  index={index}
                  total={visibleStations.length}
                  width={carouselCardWidth}
                  height={previewCardHeight}
                  meta={
                    locationContext === 'in-paris'
                      ? formatDistance(distanceInMeters(coordinate, item.coordinate))
                      : item.arrondissement ?? 'Paris'
                  }
                  onOpen={() =>
                    router.push({ pathname: '/station/[id]', params: { id: item.id } })
                  }
                />
              )}
            />
          ) : focusedCell ? (
            <View style={styles.gridSelectionCard}>
              <GlassSurface />
              <Text style={styles.gridSelectionKicker}>
                {cellRemainingCount(focusedCell) === 0 ? 'SECTEUR COMPLÉTÉ' : 'ARCHIVES'} ·{' '}
                {cellPlaceName(focusedCell, locatedStations)} · N°{focusedCell.name}
              </Text>
              <Text style={styles.gridSelectionTitle}>
                {remainingLabel(cellRemainingCount(focusedCell))}
              </Text>
              <Text style={styles.gridSelectionMeta}>
                {cellRemainingCount(focusedCell) === 0
                  ? `${plural(focusedCell.published1970, 'photo')} ${focusedCell.published1970 > 1 ? 'refaites' : 'refaite'} dans ce secteur.`
                  : 'Les archives sont regroupées dans une zone de 250 m jusqu’à ce que leur point de vue soit reconnu.'}
              </Text>
            </View>
          ) : hasNoFilteredSearchResults ? (
            <View style={styles.gridHintCard}>
              <GlassSurface />
              <Text style={styles.gridHintTitle}>
                {emptySearchTitle(filter)}
              </Text>
              <Text style={styles.gridHintCopy}>
                {emptySearchCopy(filter, query)}
              </Text>
            </View>
          ) : null}
          </MapPreviewSheet>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.blueMist,
  },
  topOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  searchBar: {
    flex: 1,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(247, 251, 252, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    paddingHorizontal: Spacing.three,
    // Sans ce clip, le fond en verre dépasse en rectangle des coins arrondis du conteneur.
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    ...Shadow.card,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    ...Typography.body,
  },
  coverageBadge: {
    height: 50,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(247, 251, 252, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    ...Shadow.card,
  },
  coverageBadgeText: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    ...Typography.title,
  },
  clearButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPanel: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: 'rgba(247, 251, 252, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    overflow: 'hidden',
    ...Shadow.card,
  },
  searchPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  searchPanelKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    letterSpacing: 0.65,
    ...Typography.caption,
    fontWeight: '700',
  },
  searchPanelTitle: {
    marginTop: Spacing.one,
    color: Palette.ink,
    fontFamily: Fonts.display,
    ...Typography.title,
  },
  searchCloseButton: {
    minHeight: 32,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCloseText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '700',
  },
  searchResults: {
    marginTop: Spacing.two,
  },
  searchResult: {
    minHeight: 58,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(22, 63, 91, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchResultPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  searchResultImage: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: Palette.blueMist,
  },
  searchResultFallback: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultCopy: {
    flex: 1,
  },
  searchResultTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    ...Typography.body,
    fontWeight: '600',
  },
  searchResultMeta: {
    marginTop: Spacing.one,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    letterSpacing: 0.35,
    ...Typography.caption,
    fontWeight: '700',
  },
  searchMore: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    ...Typography.caption,
  },
  searchEmpty: {
    minHeight: 76,
    marginTop: Spacing.two,
    padding: Spacing.twoHalf,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchEmptyCopy: {
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    ...Typography.body,
  },
  searchGuideCopy: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    ...Typography.body,
  },
  searchShortcuts: {
    marginTop: Spacing.twoHalf,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  searchShortcut: {
    minHeight: 34,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  searchShortcutText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '700',
  },
  filterSegment: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    padding: Spacing.half,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
  },
  filterSegmentOption: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSegmentOptionActive: {
    backgroundColor: Palette.parisBlue,
  },
  filterSegmentLabel: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '700',
  },
  filterSegmentLabelActive: {
    color: Palette.white,
  },
  gridMarker: {
    minWidth: 46,
    height: 30,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueDeep,
    borderWidth: 2,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridMarkerText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    ...Typography.caption,
    fontWeight: '700',
  },
  unlocatedCluster: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: Spacing.two,
    borderRadius: 21,
    backgroundColor: Palette.copper,
    borderWidth: 3,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  unlocatedCountText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    ...Typography.caption,
    fontWeight: '700',
  },
  selectedPointHalo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: Palette.white,
    backgroundColor: 'rgba(240, 182, 66, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  selectedPointCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.blueDeep,
  },
  userLocationMarker: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocationHalo: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(10, 111, 196, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(10, 111, 196, 0.28)',
  },
  userLocationRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.blueDeep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  userLocationDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0A6FC4',
  },
  mapControls: {
    position: 'absolute',
    right: Spacing.three,
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  mapControlGroup: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  returnToParisButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Shadow.card,
  },
  returnToParisText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
  },
  mapButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonPressed: {
    backgroundColor: Palette.blueMist,
  },
  mapControlDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.twoHalf,
    backgroundColor: Palette.line,
  },
  compassNorth: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.parisBlue,
    marginBottom: 2,
  },
  compassNeedle: {
    alignItems: 'center',
  },
  compassNeedleNorth: {
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Palette.copper,
  },
  compassNeedleSouth: {
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Palette.parisBlue,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 110,
  },
  archiveNavigator: {
    gap: Spacing.two,
  },
  // Pas de hauteur figée : un nom de lieu sur deux lignes doit agrandir la fiche plutôt que
  // déborder par-dessus le carrousel qui la suit.
  archiveNavigatorHeader: {
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.76)',
    backgroundColor: 'rgba(247, 251, 252, 0.16)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    ...Shadow.card,
  },
  carouselContent: {
    paddingLeft: Spacing.three,
    gap: Spacing.two,
  },
  photoPreviewCard: {
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    ...Shadow.card,
  },
  photoPreviewPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  photoPreviewFallback: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.twoHalf,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: Palette.archive,
  },
  photoPreviewFallbackIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(185, 95, 62, 0.14)',
  },
  photoPreviewFallbackTitle: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    ...Typography.title,
  },
  photoPreviewFallbackCopy: {
    marginTop: Spacing.one,
    maxWidth: 240,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    ...Typography.caption,
  },
  photoPreviewShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(8, 17, 22, 0.1)',
  },
  photoPreviewTop: {
    position: 'absolute',
    top: Spacing.twoHalf,
    left: Spacing.twoHalf,
    right: Spacing.twoHalf,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoStatus: {
    minHeight: 29,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStatusText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    letterSpacing: 0.45,
    ...Typography.caption,
    fontWeight: '700',
  },
  photoCounter: {
    minHeight: 29,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.66)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  photoCounterText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    ...Typography.caption,
    fontWeight: '700',
  },
  photoPreviewBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 114,
    padding: Spacing.three,
    paddingTop: Spacing.two,
    backgroundColor: 'rgba(8, 17, 22, 0.82)',
  },
  photoPreviewKicker: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
    ...Typography.caption,
    fontWeight: '700',
  },
  photoPreviewTitle: {
    marginTop: Spacing.one,
    paddingTop: Spacing.half,
    color: Palette.white,
    fontFamily: Fonts.display,
    ...Typography.title,
  },
  photoPreviewMetaRow: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  photoPreviewMeta: {
    flex: 1,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '600',
  },
  photoPreviewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  photoPreviewActionText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '700',
  },
  gridSelectionCard: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: 'rgba(247, 251, 252, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.76)',
    overflow: 'hidden',
    ...Shadow.card,
  },
  gridSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  // Depuis que le secteur s'annonce par son arrondissement, le kicker tient sur deux lignes :
  // sans cette contrainte il pousse le bouton d'ouverture hors de la carte, qui le rogne.
  gridSelectionTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  gridSelectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
    ...Typography.caption,
    fontWeight: '700',
  },
  gridSelectionTitle: {
    marginTop: Spacing.one,
    color: Palette.ink,
    fontFamily: Fonts.display,
    ...Typography.title,
  },
  gridSelectionMeta: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '600',
  },
  // `minWidth: 0` empêche ce bloc de texte de pousser le bouton de fermeture hors de la fiche
  // quand le nom du lieu s'étend sur deux lignes.
  archiveRailHeading: {
    flex: 1,
    minWidth: 0,
  },
  archiveRailTitle: {
    marginTop: Spacing.half,
    color: Palette.ink,
    fontFamily: Fonts.display,
    ...Typography.title,
  },
  archiveRailMeta: {
    marginTop: Spacing.half,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '600',
  },
  archiveRailClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOpenButton: {
    flexShrink: 0,
    minHeight: 40,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  gridOpenText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: '700',
  },
  gridHintCard: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: 'rgba(247, 251, 252, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.76)',
    overflow: 'hidden',
    ...Shadow.card,
  },
  gridHintTitle: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    ...Typography.title,
  },
  gridHintCopy: {
    marginTop: Spacing.one,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    ...Typography.body,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
