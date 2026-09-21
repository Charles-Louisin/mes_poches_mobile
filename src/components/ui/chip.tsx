import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function Chip({
  label,
  active,
  onPress,
  icon,
  loading,
  disabled,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}) {
  const busy = !!loading;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!(disabled || busy), busy }}
      style={[styles.chip, active && styles.on, (disabled || busy) && styles.disabled]}>
      <View style={styles.row}>
        {busy ? <ActivityIndicator size="small" color={active ? color.white : color.primary} /> : icon}
        <Text style={[styles.text, active && styles.textOn]}>{busy ? 'En cours…' : label}</Text>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.white,
    paddingHorizontal: space[16],
    paddingVertical: 8,
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: 'center',
  },
  on: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  disabled: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: {
    fontFamily: font.sansMed,
    fontSize: 13,
    color: color.textSecondary,
  },
  textOn: {
    color: color.white,
  },
});
