import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, HitSize, Kicker, Palette, Shadow, Spacing, Typography } from '@/constants/theme';
import { RankRow } from '@/components/charts/rank-row';
import { useStations } from '@/providers/stations-provider';
import { formatContributorName } from '@/utils/community-stats';

export type StatsListKind = 'arrondissements' | 'photographes';

type Row = { key: string; label: string; count: number };

const COPY: Record<StatsListKind, { kicker: string; title: string; unit: string }> = {
  arrondissements: {
    kicker: 'Classement complet',
    title: 'Arrondissements',
    unit: 'photos refaites',
  },
  photographes: {
    kicker: 'Photographes de 1970',
    title: 'Les plus repris',
    unit: 'vues refaites',
  },
};

function isKind(value: unknown): value is StatsListKind {
  return value === 'arrondissements' || value === 'photographes';
}

/** Le classement intégral derrière un « Voir tout » de l'écran des statistiques. */
export function StatsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: StatsListKind = isKind(params.kind) ? params.kind : 'arrondissements';
  const { stats } = useStations();

  const rows = useMemo<Row[]>(() => {
    if (kind === 'photographes') {
      return stats.archivePhotographers.map((entry) => ({
        key: entry.name,
        label: formatContributorName(entry.name),
        count: entry.count,
      }));
    }
    const counts = new Map(stats.arrondissementActivity.map((entry) => [entry.code, entry.count]));
    return Array.from({ length: 20 }, (_, index) => {
      const code = `750${String(index + 1).padStart(2, '0')}`;
      return {
        key: code,
        label: index === 0 ? '1er arrondissement' : `${index + 1}e arrondissement`,
        count: counts.get(code) ?? 0,
      };
    }).sort((left, right) => right.count - left.count);
  }, [kind, stats.archivePhotographers, stats.arrondissementActivity]);

  const max = Math.max(...rows.map((row) => row.count), 1);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const copy = COPY[kind];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour aux statistiques"
          onPress={() => {
            void Haptics.selectionAsync();
            router.back();
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <SymbolView name="chevron.left" size={17} tintColor={Palette.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>{copy.kicker}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
        </View>
      </View>
      <Text style={styles.summary}>
        {rows.length.toLocaleString('fr-FR')} {kind === 'photographes' ? 'photographes' : 'arrondissements'}{' '}
        · {total.toLocaleString('fr-FR')} {copy.unit}
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        renderItem={({ item, index }) => (
          <RankRow
            rank={index + 1}
            label={item.label}
            count={item.count}
            max={max}
            unit={copy.unit}
            first={index === 0}
            last={index === rows.length - 1}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  header: {
    minHeight: 76,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  back: {
    width: HitSize,
    height: HitSize,
    borderRadius: HitSize / 2,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    ...Kicker,
    color: Palette.go,
  },
  title: {
    ...Typography.display,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  summary: {
    ...Typography.caption,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.twoHalf,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
});
