import { StyleSheet, View } from 'react-native';

import { useColors } from '@/constants/theme';

export function Divider({ inset = 0, spacing = 0 }: { inset?: number; spacing?: number }) {
  const colors = useColors();
  return (
    <View
      importantForAccessibility="no"
      style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: inset, marginVertical: spacing }}
    />
  );
}
