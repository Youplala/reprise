import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { SourcePill } from '@/components/source-pill';
import { StationCard } from '@/components/station-card';
import { Fonts, Palette, Radius, Shadow, Spacing, TabBarClearance } from '@/constants/theme';

import { useStations } from '@/providers/stations-provider';
import { loadFeaturedMission, loadPublishedSubmissions } from '@/services/observatoire-api';
import { getSavedCaptures } from '@/services/fieldbook';
import type { StationDetail } from '@/types/station';
import {
  CONTRIBUTOR_COUNT,
  formatContributorName,
  RECAPTURES_LAST_30_DAYS,
  TOP_CONTRIBUTORS,
} from '@/utils/community-stats';
import { mappingStatus } from '@/utils/mapping-coverage';

function LiveComparisonCard({
  detail,
  cheered,
  onCheer,
  onOpen,
}: {
  detail: StationDetail;
  cheered: boolean;
  onCheer: () => void;
  onOpen: () => void;
}) {
  if (!detail.referenceImage || !detail.recaptureImage) return null;

  return (
    <View style={styles.activityCard}>
      <BeforeAfterSlider
        before={detail.referenceImage}
        after={detail.recaptureImage}
        beforeLabel={String(detail.year)}
        afterLabel="2026"
        borderRadius={0}
      />
      <View style={styles.activityBody}>
        <Text style={styles.activityKicker}>REPRISE PUBLIÉE · OBSERVATOIRE</Text>
        <Text style={styles.activityTitle}>{detail.name}</Text>
        <Text style={styles.activityMeta}>
          {detail.currentAuthor ? `${detail.currentAuthor} · ` : ''}
          {detail.arrondissement ?? 'Paris'}
        </Text>
        <View style={styles.activityActions}>
          <Pressable
            onPress={onCheer}
            style={[styles.cheerButton, cheered && styles.cheerButtonActive]}>
            <SymbolView
              name={cheered ? 'hands.clap.fill' : 'hands.clap'}
              size={17}
              tintColor={cheered ? Palette.blueDeep : Palette.parisBlue}
            />
            <Text style={[styles.cheerText, cheered && styles.cheerTextActive]}>
              {cheered ? 'Encouragé' : 'Encourager'}
            </Text>
          </Pressable>
          <Pressable onPress={onOpen} style={styles.detailButton}>
            <Text style={styles.detailText}>Voir le point de vue</Text>
            <SymbolView name="arrow.right" size={13} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CollectiveScreen() {
  const router = useRouter();
  const { stations, snapshotVersion, coverage } = useStations();
  // Les reprises publiées sont dans l'instantané : plus de requêtes en cascade pour les trouver.
  const feed = useMemo(() => loadPublishedSubmissions(6), []);
  const feedStatus: 'loading' | 'ready' | 'error' = feed.length ? 'ready' : 'error';
  const [cheers, setCheers] = useState<Record<string, boolean>>({});
  const [savedCount, setSavedCount] = useState(0);
  const remainingMissions = useMemo(
    () => stations.filter((station) => mappingStatus(station) === 'to-reprise').slice(0, 6),
    [stations],
  );

  useFocusEffect(
    useCallback(() => {
      getSavedCaptures().then((captures) => setSavedCount(captures.length));
    }, []),
  );

  const toggleCheer = (id: string) => {
    const next = !cheers[id];
    void (next
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
    setCheers((current) => ({ ...current, [id]: next }));
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brand}>COLLECTIF</Text>
              <Text style={styles.brandSub}>Les regards qui refont Paris</Text>
            </View>
            <SourcePill version={snapshotVersion} />
          </View>

          <Text style={styles.eyebrow}>EN DIRECT DE L’OBSERVATOIRE</Text>
          <Text style={styles.title}>Une ville,{'\n'}mille points de vue.</Text>
          <Text style={styles.copy}>
            Regardez les paires avant après publiées, choisissez une mission proche, puis aidez à
            refaire la carte de Paris.
          </Text>
        </SafeAreaView>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {coverage.published1970.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.statLabel}>REPRISES 1970</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{coverage.percentage}%</Text>
            <Text style={styles.statLabel}>PHOTOS REPRISES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {coverage.remaining1970.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.statLabel}>À REPRENDRE</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Haptics.selectionAsync();
            router.push('/coverage');
          }}
          style={({ pressed }) => [styles.contributors, pressed && styles.contributorsPressed]}>
          <View style={styles.contributorsHead}>
            <Text style={styles.contributorsKicker}>
              {CONTRIBUTOR_COUNT} CONTRIBUTEURS · {RECAPTURES_LAST_30_DAYS} REPRISES CE MOIS-CI
            </Text>
            <SymbolView name="chevron.right" size={13} tintColor={Palette.inkSoft} />
          </View>
          <View style={styles.contributorsList}>
            {TOP_CONTRIBUTORS.slice(0, 3).map((contributor) => (
              <View key={contributor.name} style={styles.contributorChip}>
                <Text style={styles.contributorInitials}>
                  {contributor.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toLocaleUpperCase('fr-FR'))
                    .join('')}
                </Text>
                <Text style={styles.contributorName} numberOfLines={1}>
                  {formatContributorName(contributor.name)}
                </Text>
                <Text style={styles.contributorCount}>{contributor.count}</Text>
              </View>
            ))}
          </View>
        </Pressable>

        <View style={styles.fieldbookStatus}>
          <SymbolView name="bookmark.fill" size={15} tintColor={Palette.parisBlue} />
          <Text style={styles.fieldbookStatusText}>
            {savedCount
              ? `${savedCount} ${savedCount > 1 ? 'prises conservées' : 'prise conservée'} dans mon carnet`
              : 'Commencer ma première reprise'}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>DONNÉES PUBLIQUES · AVANT / 2026</Text>
            <Text style={styles.sectionTitle}>Vues publiées</Text>
          </View>
          <SymbolView name="arrow.left.and.right" size={18} tintColor={Palette.parisBlue} />
        </View>

        {feedStatus === 'ready' ? (
          feed.map((detail) => (
            <LiveComparisonCard
              key={detail.id}
              detail={detail}
              cheered={Boolean(cheers[detail.id])}
              onCheer={() => toggleCheer(detail.id)}
              onOpen={() =>
                router.push({ pathname: '/station/[id]', params: { id: detail.id } })
              }
              />
          ))
        ) : (
          <View style={styles.feedLoading}>
            <SymbolView name="photo.on.rectangle.angled" size={24} tintColor={Palette.inkSoft} />
            <Text style={styles.loadingTitle}>Aucune reprise publiée pour l’instant</Text>
            <Text style={styles.loadingCopy}>
              Les comparaisons avant/après apparaîtront ici dès qu’une vue sera republiée.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>MISSIONS OUVERTES · FONDS 1970</Text>
            <Text style={styles.sectionTitle}>Encore à reprendre</Text>
          </View>
          <SymbolView name="scope" size={19} tintColor={Palette.copper} />
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.missionRail}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}>
          {remainingMissions.map((station) => (
            <StationCard key={station.id} station={station} compact />
          ))}
        </ScrollView>

        <View style={styles.walkCard}>
          <View style={styles.walkMap}>
            <View style={[styles.walkPath, { transform: [{ rotate: '-8deg' }] }]} />
            {[
              { left: '19%' as const, top: '58%' as const },
              { left: '43%' as const, top: '33%' as const },
              { left: '71%' as const, top: '49%' as const },
            ].map((position, index) => (
              <View key={index} style={[styles.walkPin, position]}>
                <Text style={styles.walkPinText}>{index + 1}</Text>
              </View>
            ))}
          </View>
          <View style={styles.walkBody}>
            <View style={styles.walkKickerRow}>
              <Text style={styles.walkKicker}>MARCHE COLLECTIVE · 11e</Text>
              <View style={styles.walkAvatarStack}>
                {['#B95F3E', '#70897C', '#F0B642'].map((color, index) => (
                  <View
                    key={color}
                    style={[styles.walkAvatar, { backgroundColor: color, marginLeft: index ? -7 : 0 }]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.walkTitle}>Résoudre le carré 839 ensemble</Text>
            <Text style={styles.walkCopy}>
              Treize vues, une zone de 250 m et beaucoup d’indices. Préparez une sortie à plusieurs.
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/station/[id]',
                  params: { id: loadFeaturedMission().id },
                })
              }
              style={({ pressed }) => [styles.walkAction, pressed && styles.pressed]}>
              <Text style={styles.walkActionText}>Rejoindre la mission</Text>
              <SymbolView name="arrow.right" size={14} tintColor={Palette.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.prototypeNote}>
          <SymbolView name="person.2.wave.2" size={22} tintColor={Palette.parisBlue} />
          <Text style={styles.prototypeText}>
            Archives 1970: Bibliothèques spécialisées de la Ville de Paris. Reprises: Observatoire
            public. Les encouragements et sorties restent sur cet iPhone dans cette version.
          </Text>
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
  content: {
    paddingBottom: TabBarClearance,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  brandRow: {
    minHeight: 62,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 2.2,
  },
  brandSub: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    marginTop: -2,
  },
  eyebrow: {
    marginTop: Spacing.three,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -1.2,
    fontWeight: '800',
  },
  copy: {
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  stats: {
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 27,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 2,
    color: Palette.blueMist,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  contributors: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    gap: Spacing.twoHalf,
    ...Shadow.card,
  },
  contributorsPressed: {
    opacity: 0.75,
  },
  contributorsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contributorsKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  contributorsList: {
    gap: Spacing.two,
  },
  contributorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  contributorInitials: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Palette.blueMist,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 30,
  },
  contributorName: {
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  contributorCount: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
  },
  fieldbookStatus: {
    alignSelf: 'center',
    minHeight: 38,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fieldbookStatusText: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    marginTop: 4,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 29,
    fontWeight: '800',
  },
  activityCard: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  activityBody: {
    padding: Spacing.three,
  },
  activityKicker: {
    color: Palette.lichen,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  retryButton: {
    minHeight: 44,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.two,
  },
  retryText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
  },
  activityTitle: {
    marginTop: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 25,
    fontWeight: '800',
  },
  activityMeta: {
    marginTop: 4,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  activityActions: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cheerButton: {
    minHeight: 38,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueMist,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cheerButtonActive: {
    backgroundColor: Palette.brass,
  },
  cheerText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
  },
  cheerTextActive: {
    color: Palette.blueDeep,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
  },
  feedLoading: {
    marginHorizontal: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    alignItems: 'center',
  },
  loadingMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: Palette.blueMist,
    borderTopColor: Palette.parisBlue,
  },
  loadingTitle: {
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
  },
  loadingCopy: {
    marginTop: 5,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  missionRail: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  walkCard: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.three,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
    ...Shadow.card,
  },
  walkMap: {
    height: 170,
    backgroundColor: Palette.blueMist,
    overflow: 'hidden',
  },
  walkPath: {
    position: 'absolute',
    left: '12%',
    right: '10%',
    top: '46%',
    height: 5,
    borderRadius: 3,
    backgroundColor: Palette.copper,
  },
  walkPin: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    backgroundColor: Palette.parisBlue,
    borderWidth: 3,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkPinText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
  },
  walkBody: {
    padding: Spacing.three,
  },
  walkKickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walkKicker: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  walkAvatarStack: {
    flexDirection: 'row',
  },
  walkAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Palette.blueDeep,
  },
  walkTitle: {
    marginTop: Spacing.two,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
  },
  walkCopy: {
    marginTop: Spacing.two,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  walkAction: {
    marginTop: Spacing.three,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.copper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  walkActionText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
  },
  prototypeNote: {
    margin: Spacing.three,
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.line,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  prototypeText: {
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
