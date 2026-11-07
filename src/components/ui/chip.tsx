import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { color, radius, space, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function Chip({
  label,
  active,
  onPress,
  icon,
  loading,
  disabled,
  affordance,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  affordance?: boolean;
}) {
  const busy = !!loading;
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!(disabled || busy), busy }}
      style={[
        styles.chip,
        affordance && styles.affordance,
        active && styles.on,
        (disabled || busy) && styles.disabled,
      ]}>
      <View style={styles.row}>
        {busy ? <ActivityIndicator size="small" color={active ? color.white : color.primary} /> : icon}
        <Text style={[styles.text, affordance && styles.textAffordance, active && styles.textOn]}>
          {busy ? 'En cours…' : label}
        </Text>
        {affordance && !busy ? (
          <ChevronDown color={active ? color.white : color.primary} size={16} strokeWidth={2.2} />
        ) : null}
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
  affordance: {
    backgroundColor: color.primaryLight,
    borderColor: '#BFDBFE',
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
  textAffordance: {
    color: color.primaryDark,
  },
  textOn: {
    color: color.white,
  },
});
