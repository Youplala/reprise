import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { BeforeAfterSlider } from '@/components/before-after-slider';
import { ParisGoBadge } from '@/components/paris-go-badge';
import { SourcePill } from '@/components/source-pill';
import { Fonts, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import type { StationDetail } from '@/types/station';
import {
  contributorKey,
  formatContributorName,
} from '@/utils/community-stats';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Initiales lisibles pour l'avatar, calculées sur le nom déjà réduit par `formatContributorName`. */
function initialsFor(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .filter((part) => !['de', 'du', 'des', 'le', 'la'].includes(part.toLocaleLowerCase('fr-FR')))
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr-FR'))
    .join('');
}

function arrondissementLabel(value?: string) {
  if (!value || !/^750\d{2}$/.test(value)) return value ?? 'Paris';
  const number = Number(value.slice(3));
  return `Paris ${number === 1 ? '1er' : `${number}e`}`;
}

function ContributorPhotoCard({
  detail,
  onOpen,
}: {
  detail: StationDetail;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Ouvrir la photo refaite ${detail.name}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.photoCard,
        pressed && styles.photoCardPressed,
      ]}>
      {detail.referenceImage && detail.recaptureImage ? (
        <BeforeAfterSlider before={detail.referenceImage} after={detail.recaptureImage}
          beforeLabel={String(detail.year)} afterLabel="2026" borderRadius={0} />
      ) : (
        <View style={styles.photoFallback}>
          {detail.recaptureImage || detail.referenceImage ? (
            <AdaptivePhoto source={(detail.recaptureImage ?? detail.referenceImage)!} style={StyleSheet.absoluteFill} />
          ) : null}
        </View>
      )}
      <View style={styles.photoCaption}>
        <ParisGoBadge photo={detail} />
        <Text style={styles.photoTitle} numberOfLines={2}>
          {detail.name}
        </Text>
        <View style={styles.photoMetaRow}>
          <Text style={styles.photoMeta}>
            {arrondissementLabel(detail.arrondissement)}
            {detail.recaptureDate ? ` · ${dateFormat.format(new Date(`${detail.recaptureDate}T12:00:00`))}` : ''}
          </Text>
          <SymbolView name="arrow.right" size={15} tintColor={Palette.parisBlue} />
        </View>
      </View>
    </Pressable>
  );
}

export function ContributorScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { stats, snapshotVersion, findContributorSubmissions } = useStations();
  const requestedName = name ?? '';
  const contributorIndex = stats.topContributors.findIndex(
    (contributor) => contributorKey(contributor.name) === contributorKey(requestedName),
  );
  const contributor = stats.topContributors[contributorIndex];
  const displayName = formatContributorName(contributor?.name ?? requestedName);
  const photos = useMemo(
    () => findContributorSubmissions(requestedName),
    [findContributorSubmissions, requestedName],
  );

  const profileStats = useMemo(() => {
    const areaCounts = new Map<string, number>();
    photos.forEach((photo) => {
      const area = arrondissementLabel(photo.arrondissement);
      areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    });
    const latestDate = photos.find((photo) => photo.recaptureDate)?.recaptureDate;
    return {
      areaCount: areaCounts.size,
      latestDate,
    };
  }, [photos]);

  const openPhoto = (detail: StationDetail) => {
    void Haptics.selectionAsync();
    router.push({ pathname: '/station/[id]', params: { id: detail.id } });
  };

  const header = (
    <View style={styles.profileHeader}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable
          accessibilityLabel="Retour"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <SymbolView name="chevron.left" size={17} tintColor={Palette.ink} />
        </Pressable>
        <Text style={styles.context}>Communauté</Text>
      </SafeAreaView>

      <View style={styles.hero}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(displayName)}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text accessibilityRole="header" style={styles.name}>{displayName || 'Contributeur'}</Text>
          </View>
        </View>
        {photos.length === 0 ? (
          <Text style={styles.intro}>Aucune photo publiée ne correspond encore à ce profil.</Text>
        ) : null}
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{photos.length}</Text>
          <Text style={styles.metricLabel}>Photos</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{profileStats.areaCount}</Text>
          <Text accessibilityLabel="Arrondissements" style={styles.metricLabel}>Arrond.</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {contributorIndex >= 0 ? `#${contributorIndex + 1}` : '—'}
          </Text>
          <Text accessibilityLabel="Rang dans le classement" style={styles.metricLabel}>Rang</Text>
        </View>
      </View>

      {profileStats.latestDate ? (
        <View style={styles.insightRow}>
          <SymbolView name="calendar" size={14} tintColor={Palette.inkSoft} />
          <Text style={styles.insightText}>
            Dernière photo le {dateFormat.format(new Date(`${profileStats.latestDate}T12:00:00`))}
          </Text>
        </View>
      ) : null}

      <View style={styles.galleryHeader}>
        <Text style={styles.galleryTitle}>Ses photos</Text>
        <Text style={styles.sortLabel}>Les plus récentes d’abord</Text>
      </View>
    </View>
  );

  // Même lecture que le fil Communauté : comparaison entière, légende, séparation.
  return (
    <View style={styles.screen}>
      <FlatList
        data={photos}
        keyExtractor={(photo) => photo.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={<View style={styles.sourceNote}><SourcePill version={snapshotVersion} /></View>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <SymbolView name="photo.on.rectangle.angled" size={26} tintColor={Palette.copper} />
            <Text style={styles.emptyTitle}>Aucune photo à afficher</Text>
            <Text style={styles.emptyText}>Revenez aux contributeurs pour choisir un autre profil.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ContributorPhotoCard detail={item} onOpen={() => openPhoto(item)} />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.blueMist },
  content: { paddingBottom: Spacing.four },
  profileHeader: { backgroundColor: Palette.fog },
  topBar: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  context: { ...Typography.body, color: Palette.inkSoft, fontFamily: Fonts.sans },
  hero: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Palette.parisBlue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...Typography.title, color: Palette.white, fontFamily: Fonts.display, fontWeight: '900' },
  identityCopy: { flex: 1 },
  name: { ...Typography.display, fontSize: 28, color: Palette.parisBlue, fontFamily: Fonts.display, fontWeight: '900' },
  intro: { ...Typography.body, marginTop: Spacing.three, color: Palette.inkSoft, fontFamily: Fonts.sans },
  metrics: { marginTop: Spacing.three, marginHorizontal: Spacing.three, paddingVertical: Spacing.three, borderRadius: Radius.medium, backgroundColor: Palette.white, flexDirection: 'row' },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.one },
  metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Palette.line },
  metricValue: { ...Typography.title, color: Palette.parisBlue, fontFamily: Fonts.display, fontWeight: '900' },
  metricLabel: { ...Typography.caption, marginTop: Spacing.half, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  insightRow: { marginTop: Spacing.twoHalf, marginHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  insightText: { ...Typography.caption, flex: 1, color: Palette.inkSoft, fontFamily: Fonts.sans },
  galleryHeader: { marginTop: Spacing.four, marginBottom: Spacing.twoHalf, paddingHorizontal: Spacing.three },
  galleryTitle: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display },
  sortLabel: { ...Typography.caption, marginTop: Spacing.half, color: Palette.inkSoft, fontFamily: Fonts.sans },
  photoCard: { marginBottom: Spacing.twoHalf, borderBottomWidth: 1, borderBottomColor: Palette.line },
  photoCardPressed: { opacity: 0.9 },
  photoFallback: { height: 240, backgroundColor: Palette.archive },
  photoCaption: { backgroundColor: Palette.white, paddingTop: Spacing.twoHalf, paddingBottom: Spacing.four, paddingHorizontal: Spacing.three },
  photoTitle: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  photoMetaRow: { marginTop: Spacing.one, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  photoMeta: { ...Typography.body, flex: 1, color: Palette.inkSoft, fontFamily: Fonts.sans },
  sourceNote: { alignItems: 'center', padding: Spacing.three },
  empty: { backgroundColor: Palette.fog, padding: Spacing.four, alignItems: 'center' },
  emptyTitle: { ...Typography.title, marginTop: Spacing.two, color: Palette.ink, fontFamily: Fonts.display },
  emptyText: { ...Typography.body, marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
