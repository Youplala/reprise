import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import { formatContributorName, searchContributors } from '@/utils/community-stats';

export function ContributorsScreen() {
  const router = useRouter();
  const { stats } = useStations();
  const [query, setQuery] = useState('');
  // Malgré son nom historique, topContributors contient tous les auteurs du relevé.
  const contributors = useMemo(() => searchContributors(stats.topContributors, query), [stats.topContributors, query]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour à la communauté"
          onPress={() => router.back()} style={styles.back}>
          <SymbolView name="chevron.left" size={18} tintColor={Palette.parisBlue} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Contributeurs</Text>
      </View>
      <View style={styles.search}>
        <SymbolView name="magnifyingglass" size={19} tintColor={Palette.inkSoft} />
        <TextInput
          accessibilityLabel="Rechercher un contributeur par prénom"
          placeholder="Rechercher par prénom"
          placeholderTextColor={Palette.inkSoft}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          style={styles.input}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche"
            onPress={() => setQuery('')} style={styles.clear}>
            <SymbolView name="xmark.circle.fill" size={19} tintColor={Palette.inkSoft} />
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.count}>
        {contributors.length} {contributors.length > 1 ? 'contributeurs' : 'contributeur'}
        {query.trim() ? (contributors.length > 1 ? ' trouvés' : ' trouvé') : ' dans le relevé'}
      </Text>
      <FlatList
        data={contributors}
        keyExtractor={(item) => item.name}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucun contributeur trouvé</Text>
            <Text style={styles.emptyCopy}>Essayez un autre prénom. Seuls les auteurs de photos publiées dans le relevé sont disponibles.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const displayName = formatContributorName(item.name);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Voir les photos de ${displayName}, ${item.count} ${item.count > 1 ? 'photos' : 'photo'}`}
              onPress={() => {
                Keyboard.dismiss();
                router.push({ pathname: '/contributor/[name]', params: { name: item.name } });
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.identity}>
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.meta}>{item.count} {item.count > 1 ? 'photos publiées' : 'photo publiée'}</Text>
              </View>
              <SymbolView name="chevron.right" size={15} tintColor={Palette.parisBlue} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  header: { minHeight: 70, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.display, fontFamily: Fonts.display, fontSize: 28, color: Palette.parisBlue, flex: 1, fontWeight: '900' },
  search: { margin: Spacing.three, marginTop: Spacing.two, paddingLeft: Spacing.three, minHeight: 48, borderRadius: Radius.medium, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { ...Typography.body, fontFamily: Fonts.sans, color: Palette.ink, flex: 1, minHeight: 48, paddingVertical: Spacing.two, paddingRight: Spacing.two },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.inkSoft, marginHorizontal: Spacing.three, marginBottom: Spacing.two },
  list: { paddingBottom: Spacing.four },
  row: { minHeight: 76, padding: Spacing.three, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  identity: { flex: 1 },
  name: { ...Typography.title, fontFamily: Fonts.display, color: Palette.ink },
  meta: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.inkSoft, marginTop: Spacing.one },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.line, marginLeft: Spacing.three },
  pressed: { backgroundColor: Palette.blueMist },
  empty: { padding: Spacing.four },
  emptyTitle: { ...Typography.title, fontFamily: Fonts.display, color: Palette.ink },
  emptyCopy: { ...Typography.body, fontFamily: Fonts.sans, color: Palette.inkSoft, marginTop: Spacing.two },
});
