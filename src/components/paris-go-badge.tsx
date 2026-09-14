import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Typography } from '@/constants/theme';
import { isParisGoRecapture } from '@/utils/recapture-provenance';

export function ParisGoBadge({ photo }: { photo: Parameters<typeof isParisGoRecapture>[0] }) {
  if (!isParisGoRecapture(photo)) return null;
  return (
    <View accessible accessibilityLabel="Photo refaite avec Paris GO" style={styles.badge}>
      <View style={styles.emblem}>
        <SymbolView name="camera.fill" size={13} tintColor={Palette.parisBlue} />
      </View>
      <Text style={styles.label}>Refaite avec <Text style={styles.brand}>Paris GO</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Palette.parisBlue, borderRadius: 10, padding: 5, paddingRight: 10, marginBottom: 10 },
  emblem: { width: 24, height: 24, borderRadius: 7, backgroundColor: Palette.brass,
    alignItems: 'center', justifyContent: 'center' },
  label: { ...Typography.caption, color: Palette.white, fontFamily: Fonts.sans, flexShrink: 1 },
  brand: { fontWeight: '800' },
});
