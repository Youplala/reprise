import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Palette } from '@/constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Palette.white}
      indicatorColor={Palette.blueMist}
      tintColor={Palette.parisBlue}
      labelStyle={{
        default: { color: Palette.inkSoft, fontSize: 11 },
        selected: { color: Palette.parisBlue, fontSize: 11, fontWeight: '700' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Autour</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'location', selected: 'location.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Carte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collective">
        <NativeTabs.Trigger.Label>Collectif</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
