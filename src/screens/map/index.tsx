import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
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
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';

import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';

import { useUserLocation } from '@/hooks/use-user-location';
import { useFeaturedMission, useStations } from '@/providers/stations-provider';
import type { StationSummary } from '@/types/station';
import { distanceInMeters, formatDistance } from '@/utils/distance';
import {
  mappingStatus,
  stationMatchesFilter,
  type CoverageCell,
  type MapFilter,
  cellsWithinViewport,
} from '@/utils/mapping-coverage';

const INITIAL_REGION: Region = {
  latitude: 48.8607,
  longitude: 2.3476,
  latitudeDelta: 0.15,
  longitudeDelta: 0.14,
};

const POINT_ZOOM_THRESHOLD = 0.047;
const FOCUSED_CELL_ZOOM_PADDING = 2.6;
const MAP_BOTTOM_OVERLAY_OFFSET = 110;
const MAP_TOP_CONTROLS_HEIGHT = 50 + 36 + 54 + Spacing.two * 2;
const FILTERS: { value: MapFilter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'to-reprise', label: 'À retrouver' },
  { value: 'published-reprise', label: 'Photos refaites' },
  { value: 'collection-2022', label: 'Photos de 2022' },
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

function cellHasFilter(cell: CoverageCell, filter: MapFilter) {
  if (filter === 'to-reprise') return cell.remaining1970 > 0;
  if (filter === 'published-reprise') return cell.published1970 > 0;
  if (filter === 'collection-2022') return cell.collection2022 > 0;
  return cell.total1970 + cell.collection2022 > 0;
}

function cellFill(cell: CoverageCell, filter: MapFilter) {
  if (!cellHasFilter(cell, filter)) return 'rgba(22, 63, 91, 0.025)';

  if (filter === 'to-reprise') {
    return `rgba(185, 95, 62, ${Math.min(0.68, 0.2 + cell.remaining1970 * 0.025)})`;
  }
  if (filter === 'published-reprise') {
    return `rgba(112, 137, 124, ${Math.min(0.78, 0.2 + cell.published1970 * 0.03)})`;
  }
  if (filter === 'collection-2022') {
    return `rgba(22, 63, 91, ${Math.min(0.76, 0.2 + cell.collection2022 * 0.05)})`;
  }

  if (!cell.total1970) return 'rgba(22, 63, 91, 0.08)';
  if (cell.percentage === 0) return 'rgba(185, 95, 62, 0.26)';
  if (cell.percentage < 25) return 'rgba(185, 95, 62, 0.48)';
  if (cell.percentage < 50) return 'rgba(240, 182, 66, 0.48)';
  if (cell.percentage < 75) return 'rgba(112, 137, 124, 0.48)';
  if (cell.percentage < 100) return 'rgba(112, 137, 124, 0.66)';
  return 'rgba(22, 63, 91, 0.78)';
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
  if (filter === 'to-reprise') return remainingLabel(cell.remaining1970);
  if (filter === 'published-reprise') {
    return `${plural(cell.published1970, 'photo')} ${cell.published1970 > 1 ? 'refaites' : 'refaite'}`;
  }
  if (filter === 'collection-2022') {
    return plural(cell.collection2022, 'photo');
  }
  return cell.remaining1970 === 0 && cell.total1970 > 0
    ? 'Secteur complété'
    : `${cell.percentage}% cartographié`;
}

function selectionAction(filter: MapFilter) {
  if (filter === 'to-reprise') return 'Voir les photos';
  if (filter === 'published-reprise') return 'Voir les photos';
  if (filter === 'collection-2022') return 'Voir les photos';
  return 'Explorer';
}

function emptySearchTitle(filter: MapFilter) {
  if (filter === 'to-reprise') return 'Aucune photo à retrouver ici';
  if (filter === 'published-reprise') return 'Aucune photo refaite ici';
  if (filter === 'collection-2022') return 'Aucune photo de 2022 ici';
  return 'Aucun résultat sur la carte';
}

function emptySearchCopy(filter: MapFilter, query: string) {
  if (filter === 'to-reprise') {
    return `« ${query} » ne contient plus de mission ouverte. Consultez les photos refaites pour voir le résultat.`;
  }
  if (filter === 'published-reprise') {
    return `Aucune photo refaite ne correspond à « ${query} ». Essayez le filtre À retrouver.`;
  }
  if (filter === 'collection-2022') {
    return `Aucune photo de 2022 ne correspond à « ${query} ».`;
  }
  return `Aucun repère ne correspond à « ${query} ». Modifiez la recherche ou déplacez la carte.`;
}

function focusedCellColors(cell: CoverageCell, filter: MapFilter) {
  if (filter === 'published-reprise' || (filter === 'all' && cell.remaining1970 === 0)) {
    return { fill: 'rgba(112, 137, 124, 0.2)', stroke: Palette.lichen };
  }
  if (filter === 'collection-2022') {
    return { fill: 'rgba(22, 63, 91, 0.16)', stroke: Palette.parisBlue };
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
  cell,
  index,
  total,
  width,
  height,
  meta,
  onOpen,
}: {
  station: StationSummary;
  cell?: CoverageCell;
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
  const remainingCount = cell?.remaining1970 ?? frameCount;
  const publishedCount = cell?.published1970 ?? 0;
  const archiveKicker =
    publishedCount > 0
      ? `${plural(remainingCount, 'PHOTO', 'PHOTOS')} À RETROUVER · ${plural(publishedCount, 'PHOTO', 'PHOTOS')} REFAITE${publishedCount > 1 ? 'S' : ''}`
      : `${plural(remainingCount, 'PHOTO', 'PHOTOS')} À RETROUVER`;

  return (
    <Pressable
      accessibilityHint="Ouvre la photographie en grand et permet de contribuer"
      accessibilityLabel={
        isArchiveSector
          ? `Explorer le secteur ${station.name}, ${remainingLabel(remainingCount)}`
          : `Ouvrir ${station.name}, ${pinLabel(station)}`
      }
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
        <View style={[styles.photoStatus, { backgroundColor: pinColor(station) }]}>
          <Text style={styles.photoStatusText}>
            {isArchiveSector
              ? 'ARCHIVES 1970'
              : `${station.year}${detail?.hasRecapture ? ' → 2026' : ''}`}
          </Text>
        </View>
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
        <Text style={styles.photoPreviewKicker}>
          {isArchiveSector ? archiveKicker : pinLabel(station)}
        </Text>
        <Text style={styles.photoPreviewTitle} numberOfLines={2}>
          {isArchiveSector ? 'Choisir une photo' : station.name}
        </Text>
        <View style={styles.photoPreviewMetaRow}>
          <Text style={styles.photoPreviewMeta} numberOfLines={1}>
            {isArchiveSector
              ? `${plural(frameCount, 'photo')} dans ce secteur`
              : meta}
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
  const { coordinate, isPrecise, loading, locate } = useUserLocation();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState<MapFilter>('all');
  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [selected, setSelected] = useState<StationSummary | undefined>();
  const [selectedCell, setSelectedCell] = useState<CoverageCell>();
  const [focusedCell, setFocusedCell] = useState<CoverageCell>();
  const [userMovedMap, setUserMovedMap] = useState(false);
  const [browseOrigin, setBrowseOrigin] = useState({
    latitude: INITIAL_REGION.latitude,
    longitude: INITIAL_REGION.longitude,
  });
  const [mapTarget, setMapTarget] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
    avoidBottomOverlay?: boolean;
  }>();
  const carouselCardWidth = screenWidth - Spacing.three * 2;
  const carouselStep = carouselCardWidth + Spacing.two;
  const previewCardHeight = Math.min(380, Math.max(300, screenHeight * 0.42));



  // La vraie grille du concours compte 1 171 mailles de 250 m. Les dessiner toutes, y compris
  // hors écran, sature le rendu de la carte : on ne garde que celles qui recoupent la vue,
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
    return ranked.slice(0, 80);
  }, [browseOrigin, filteredStations, focusedCell, statusFilteredStations]);

  // La sélection initiale suit la mission mise en avant, le temps que le relevé actif se charge.
  const currentSelection = selected ?? featuredMission;
  const activeSelected =
    visibleStations.find((station) => station.id === currentSelection?.id) ??
    visibleStations[0] ??
    filteredStations.find((station) => !station.approximate) ??
    currentSelection;

  const focusedArchiveStations = useMemo(() => {
    if (
      !focusedCell ||
      focusedCell.remaining1970 === 0 ||
      (filter !== 'all' && filter !== 'to-reprise')
    ) {
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
    if (filter !== 'all' && filter !== 'to-reprise') return [];
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

  const topOffset = Math.max(insets.top, 52) + Spacing.one;

  useEffect(() => {
    if (!mapTarget) return;
    const latitudeDelta = mapTarget.latitudeDelta ?? 0.018;
    const longitudeDelta = mapTarget.longitudeDelta ?? 0.014;
    const visibleMapTop = topOffset + MAP_TOP_CONTROLS_HEIGHT;
    const visibleMapBottom = screenHeight - MAP_BOTTOM_OVERLAY_OFFSET - previewCardHeight;
    const visibleMapCenter = (visibleMapTop + visibleMapBottom) / 2;
    const verticalOffsetRatio =
      mapTarget.avoidBottomOverlay && visibleMapBottom > visibleMapTop
        ? (screenHeight / 2 - visibleMapCenter) / screenHeight
        : 0;

    mapRef.current?.animateToRegion(
      {
        latitude: mapTarget.latitude - latitudeDelta * verticalOffsetRatio,
        longitude: mapTarget.longitude,
        latitudeDelta,
        longitudeDelta,
      },
      520,
    );
  }, [mapTarget, previewCardHeight, screenHeight, topOffset]);

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
  }, [locate, statusFilteredStations]);

  const handleSelect = useCallback((station: StationSummary) => {
    Keyboard.dismiss();
    setSelectedCell(undefined);
    setFocusedCell(undefined);
    setSelected(station);
    void Haptics.selectionAsync();
  }, []);

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
    [grid],
  );

  useEffect(() => {
    if (!requestedStationId) return;
    const requestKey = `${requestedStationId}:${focusRequest ?? ''}`;
    if (handledFocusRequest.current === requestKey) return;

    const requestedStation = stations.find(
      (station) => station.id === requestedStationId,
    );
    if (!requestedStation) return;

    handledFocusRequest.current = requestKey;
    const frame = requestAnimationFrame(() => {
      setFilter('all');
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
    Keyboard.dismiss();
    setFocusedCell(undefined);
    setSelectedCell(cell);
    void Haptics.selectionAsync();
  };

  const openGridCell = useCallback((cell: CoverageCell) => {
    const exactStations = filteredStations.filter(
      (station) => !station.approximate && stationIsInCell(station, cell),
    );
    const preferredStatus =
      filter === 'published-reprise'
        ? 'published-reprise'
        : filter === 'collection-2022'
          ? 'collection-2022'
          : filter === 'all' && cell.remaining1970 === 0
            ? 'published-reprise'
            : undefined;
    const nextSelected =
      exactStations.find(
        (station) => preferredStatus && mappingStatus(station) === preferredStatus,
      ) ?? exactStations[0];
    if (nextSelected) setSelected(nextSelected);

    setSelectedCell(undefined);
    setFocusedCell(cell);
    setBrowseOrigin(cell.center);

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
  }, [filter, filteredStations]);

  const handleResetNorth = useCallback(() => {
    mapRef.current?.animateCamera({ heading: 0 }, { duration: 300 });
  }, []);

  const handleRegionChangeComplete = useCallback(
    (nextRegion: Region) => {
      const enteredPointView =
        region.latitudeDelta > POINT_ZOOM_THRESHOLD &&
        nextRegion.latitudeDelta <= POINT_ZOOM_THRESHOLD;
      setRegion(nextRegion);
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
      setMapTarget({ ...station.coordinate });
      void Haptics.selectionAsync();
    },
    [activeSelected.id, visibleStations],
  );

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        mapType="mutedStandard"
        showsCompass={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        pitchEnabled={showIndividualPoints}
        rotateEnabled={showIndividualPoints}
        onPanDrag={() => setUserMovedMap(true)}
        onRegionChangeComplete={handleRegionChangeComplete}>
        {!showIndividualPoints
          ? visibleGrid.map((cell) => (
              <Polygon
                key={cell.id}
                coordinates={cell.coordinates}
                fillColor={cellFill(cell, filter)}
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
            fillColor={focusedCellColors(focusedCell, filter).fill}
            strokeColor={focusedCellColors(focusedCell, filter).stroke}
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

        {showIndividualPoints
          ? visibleStations.map((station) => (
              <Marker
                key={station.id}
                coordinate={station.coordinate}
                pinColor={pinColor(station)}
                opacity={isExploringArchiveCell ? 0.48 : 0.9}
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
                            ? `Secteur ${station.name}`
                            : station.name}
                        </Text>
                        <Text style={styles.searchResultMeta} numberOfLines={1}>
                          {pinLabel(station)} · {station.arrondissement ?? 'Paris'}
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
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}>
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
                    style={[styles.filterChip, active && styles.filterChipActive]}>
                    <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              accessibilityHint="Ouvre le détail des photos de 1970, de 2022 et des photos refaites aujourd’hui"
              accessibilityLabel={`${coverage.percentage}% des photos de 1970 cartographiées. Voir les statistiques`}
              accessibilityRole="button"
              onPress={() => router.push('/coverage')}
              style={({ pressed }) => [
                styles.progressCard,
                pressed && styles.progressCardPressed,
              ]}>
              <Text style={styles.progressPercent}>{coverage.percentage}%</Text>
              <View style={styles.progressInline}>
                <View style={styles.progressLabelRow}>
                  <View style={styles.progressLive}>
                    <View
                      style={[
                        styles.progressLiveDot,
                        { backgroundColor: Palette.lichen },
                      ]}
                    />
                    <Text style={styles.progressKicker}>FONDS 1970</Text>
                  </View>
                  <Text style={styles.progressMeta}>
                    {coverage.published1970.toLocaleString('fr-FR')} /{' '}
                    {coverage.total1970.toLocaleString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${coverage.percentage}%` }]}
                  />
                </View>
              </View>
              <SymbolView name="chevron.right" size={12} tintColor={Palette.parisBlue} />
            </Pressable>
          </>
        )}
      </View>

      <View
        style={[
          styles.mapControls,
          {
            bottom:
              isExploringArchiveCell ||
              (showIndividualPoints && hasSelectedExactStation)
                ? previewCardHeight + 126
                : showIndividualPoints || selectedCell
                ? 276
                : 238,
          },
        ]}>
        <Pressable
          accessibilityLabel="Revenir au nord"
          onPress={handleResetNorth}
          style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}>
          <SymbolView name="location.north.line.fill" size={20} tintColor={Palette.parisBlue} />
        </Pressable>
        <Pressable
          accessibilityLabel="Utiliser ma position"
          onPress={handleLocate}
          disabled={loading}
          style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}>
          <SymbolView
            name={isPrecise ? 'location.fill' : 'location'}
            size={20}
            tintColor={Palette.parisBlue}
          />
        </Pressable>
      </View>

      {!searchFocused ? (
        <View style={styles.bottomOverlay} pointerEvents="box-none">
          {selectedCell ? (
            <View style={styles.gridSelectionCard}>
              <GlassSurface />
              <View style={styles.gridSelectionHeader}>
                <View>
                  <Text style={styles.gridSelectionKicker}>
                    {filter === 'to-reprise'
                      ? 'À RETROUVER'
                      : filter === 'published-reprise'
                        ? 'PHOTOS REFAITES'
                        : filter === 'collection-2022'
                          ? 'PHOTOS DE 2022'
                          : showIndividualPoints
                            ? 'SECTEUR'
                            : 'COUVERTURE'}{' '}
                    · SECTEUR {selectedCell.name}
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
                  <Text style={styles.gridOpenText}>
                    {selectionAction(filter)}
                  </Text>
                  <SymbolView name="photo.on.rectangle" size={15} tintColor={Palette.white} />
                </Pressable>
              </View>
              <Text style={styles.gridSelectionMeta}>
                {filter === 'to-reprise'
                  ? `${plural(selectedCell.published1970, 'photo')} déjà ${selectedCell.published1970 > 1 ? 'refaites' : 'refaite'}`
                  : filter === 'published-reprise'
                    ? `${plural(selectedCell.total1970, 'photo')} dans les archives du secteur`
                    : filter === 'collection-2022'
                      ? 'Photos précisément localisées'
                      : `${selectedCell.published1970} sur ${selectedCell.total1970} photos refaites`}
              </Text>
            </View>
          ) : isExploringArchiveCell && focusedCell ? (
            <View style={[styles.archiveNavigator, { height: previewCardHeight }]}>
              <View style={styles.archiveNavigatorHeader}>
                <GlassSurface />
                <View style={styles.archiveRailHeading}>
                  <Text style={styles.gridSelectionKicker}>
                    ARCHIVES DE 1970 · ZONE DE 250 M
                  </Text>
                  <Text style={styles.archiveRailTitle}>
                    Secteur {focusedCell.name}
                  </Text>
                  <Text style={styles.archiveRailMeta}>
                    {plural(focusedCell.remaining1970, 'photo')} à retrouver
                    {focusedCell.published1970 > 0
                      ? ` · ${plural(focusedCell.published1970, 'photo')} ${focusedCell.published1970 > 1 ? 'refaites' : 'refaite'}`
                      : ''}
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
                    cell={focusedCell}
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
                    isPrecise
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
                {focusedCell.remaining1970 === 0 ? 'SECTEUR COMPLÉTÉ' : 'ARCHIVES'} · SECTEUR{' '}
                {focusedCell.name}
              </Text>
              <Text style={styles.gridSelectionTitle}>
                {remainingLabel(focusedCell.remaining1970)}
              </Text>
              <Text style={styles.gridSelectionMeta}>
                {focusedCell.remaining1970 === 0
                  ? `${plural(focusedCell.published1970, 'photo')} ${focusedCell.published1970 > 1 ? 'refaites' : 'refaite'} dans ce secteur.`
                  : 'Les archives sont regroupées dans une zone de 250 m jusqu’à ce que leur point de vue soit reconnu.'}
              </Text>
            </View>
          ) : (
            <View style={styles.gridHintCard}>
              <GlassSurface />
              <Text style={styles.gridHintTitle}>
                {hasNoFilteredSearchResults
                  ? emptySearchTitle(filter)
                  : showIndividualPoints
                    ? 'Coordonnées fiables'
                    : 'Progression par secteur'}
              </Text>
              <Text style={styles.gridHintCopy}>
                {hasNoFilteredSearchResults
                  ? emptySearchCopy(filter, query)
                  : showIndividualPoints
                    ? 'Les archives non localisées restent regroupées. Seules les positions vérifiées deviennent des pins.'
                    : 'Touchez une zone colorée pour voir son taux et ouvrir ses photos.'}
              </Text>
              {!showIndividualPoints ? (
                <View style={styles.gridLegend}>
                  {[
                    ['0%', 'rgba(185, 95, 62, 0.48)'],
                    ['25%', 'rgba(240, 182, 66, 0.62)'],
                    ['50%', 'rgba(112, 137, 124, 0.54)'],
                    ['100%', 'rgba(22, 63, 91, 0.82)'],
                  ].map(([label, color]) => (
                    <View key={label} style={styles.gridLegendItem}>
                      <View style={[styles.gridLegendSwatch, { backgroundColor: color }]} />
                      <Text style={styles.gridLegendLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
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
  searchBar: {
    height: 50,
    marginHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(247, 251, 252, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    paddingHorizontal: Spacing.three,
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
    fontSize: 14,
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
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  searchPanelTitle: {
    marginTop: 3,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '900',
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
    fontSize: 10,
    fontWeight: '800',
  },
  searchResults: {
    marginTop: Spacing.two,
  },
  searchResult: {
    minHeight: 58,
    paddingVertical: 7,
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
    fontSize: 13,
    fontWeight: '800',
  },
  searchResultMeta: {
    marginTop: 3,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  searchMore: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 15,
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
    fontSize: 11,
    lineHeight: 16,
  },
  searchGuideCopy: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
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
    gap: 5,
  },
  searchShortcutText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
  },
  filterContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Palette.parisBlue,
    borderColor: Palette.parisBlue,
  },
  filterLabel: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  filterLabelActive: {
    color: Palette.white,
  },
  progressCard: {
    minHeight: 54,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    ...Shadow.card,
  },
  progressCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  progressPercent: {
    minWidth: 50,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '900',
  },
  progressInline: {
    flex: 1,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  progressLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressKicker: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  progressTrack: {
    height: 4,
    marginTop: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Palette.lichen,
  },
  progressMeta: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
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
    fontSize: 10,
    fontWeight: '900',
  },
  unlocatedCluster: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 7,
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
    fontSize: 10,
    fontWeight: '900',
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
    gap: Spacing.two,
  },
  mapButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
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
  archiveNavigatorHeader: {
    height: 84,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: 9,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.76)',
    backgroundColor: 'rgba(247, 251, 252, 0.16)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '800',
    fontSize: 22,
  },
  photoPreviewFallbackCopy: {
    marginTop: 3,
    maxWidth: 240,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  photoCounter: {
    minHeight: 29,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.66)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  photoCounterText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  photoPreviewBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 114,
    padding: Spacing.three,
    paddingTop: Spacing.four,
    backgroundColor: 'rgba(8, 17, 22, 0.82)',
  },
  photoPreviewKicker: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  photoPreviewTitle: {
    marginTop: 4,
    paddingTop: 2,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
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
    fontSize: 10,
    fontWeight: '700',
  },
  photoPreviewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoPreviewActionText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '900',
  },
  selectionCard: {
    minHeight: 124,
    borderRadius: Radius.large,
    backgroundColor: 'rgba(247, 251, 252, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.58)',
    overflow: 'hidden',
    flexDirection: 'row',
    ...Shadow.card,
  },
  selectionCardActive: {
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  selectionStripe: {
    width: 5,
  },
  selectionBody: {
    flex: 1,
    padding: Spacing.twoHalf,
  },
  selectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  selectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  carouselPosition: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  carouselPositionText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '900',
  },
  selectionTitle: {
    marginTop: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '900',
  },
  selectionMeta: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionMetaText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  openAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  openActionText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
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
  gridSelectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  gridSelectionTitle: {
    marginTop: 4,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '900',
  },
  gridSelectionMeta: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
  },
  archiveRailCard: {
    marginHorizontal: Spacing.three,
    padding: Spacing.twoHalf,
    borderRadius: Radius.large,
    backgroundColor: 'rgba(247, 251, 252, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    overflow: 'hidden',
    ...Shadow.card,
  },
  archiveRailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  archiveRailHeading: {
    flex: 1,
  },
  archiveRailTitle: {
    marginTop: 2,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
  },
  archiveRailMeta: {
    marginTop: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
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
  archiveRailCopy: {
    marginTop: 4,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
  },
  archiveStationContent: {
    paddingTop: Spacing.two,
    paddingRight: Spacing.two,
    gap: Spacing.two,
  },
  archiveStationCard: {
    width: 236,
    height: 62,
    paddingRight: Spacing.two,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.84)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  archiveStationImage: {
    width: 62,
    height: 62,
    backgroundColor: Palette.archive,
  },
  archiveStationFallback: {
    width: 62,
    height: 62,
    backgroundColor: 'rgba(185, 95, 62, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveStationBody: {
    flex: 1,
  },
  archiveStationIndex: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  archiveStationTitle: {
    marginTop: 2,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
  },
  archiveStationMeta: {
    marginTop: 2,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '600',
  },
  gridOpenButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gridOpenText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
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
    fontSize: 20,
    fontWeight: '900',
  },
  gridHintCopy: {
    marginTop: 3,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  gridLegend: {
    marginTop: Spacing.twoHalf,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  gridLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gridLegendSwatch: {
    width: 14,
    height: 10,
    borderRadius: 3,
  },
  gridLegendLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
