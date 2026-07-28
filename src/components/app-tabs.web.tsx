import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View style={styles.tabListContainer}>
          <TabTrigger name="index" href="/" asChild>
            <Pressable style={styles.tabButton}>
              <Text style={styles.tabLabel}>Autour</Text>
            </Pressable>
          </TabTrigger>
          <TabTrigger name="map" href="/map" asChild>
            <Pressable style={styles.tabButton}>
              <Text style={styles.tabLabel}>Carte</Text>
            </Pressable>
          </TabTrigger>
          <TabTrigger name="collective" href="/collective" asChild>
            <Pressable style={styles.tabButton}>
              <Text style={styles.tabLabel}>Collectif</Text>
            </Pressable>
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    left: '50%',
    bottom: Spacing.three,
    transform: [{ translateX: '-50%' }],
    padding: Spacing.one,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    backgroundColor: Palette.white,
  },
  tabButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
  },
});
