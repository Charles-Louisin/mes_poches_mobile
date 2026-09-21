import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'line' | 'brass' | 'ember';

export function Button({
  label,
  onPress,
  loading,
  loadingLabel,
  disabled,
  variant = 'primary',
  icon,
  compact,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  variant?: Variant;
  icon?: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const resolved =
    variant === 'brass' ? 'primary' : variant === 'ember' ? 'danger' : variant === 'line' ? 'secondary' : variant;

  const bg =
    resolved === 'primary'
      ? color.primary
      : resolved === 'danger'
        ? color.danger
        : resolved === 'ghost'
          ? 'transparent'
          : color.white;
  const fg =
    resolved === 'primary' || resolved === 'danger' ? color.white : resolved === 'ghost' ? color.primary : color.primary;
  const border = resolved === 'secondary' ? color.primary : 'transparent';
  const busy = !!loading;
  const text = busy ? loadingLabel ?? 'En cours…' : label;

  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || busy), busy }}
      style={[
        styles.base,
        compact && styles.compact,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: resolved === 'secondary' ? 1.5 : 0,
          opacity: disabled || busy ? 0.55 : 1,
        },
        style,
      ]}>
      <View style={styles.row}>
        {busy ? <ActivityIndicator color={fg} /> : icon}
        <Text style={[styles.label, compact && styles.compactLabel, { color: fg }]} numberOfLines={1}>
          {text}
        </Text>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    width: '100%',
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: 8,
    width: undefined,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontFamily: font.sansSemi,
    fontSize: 16,
  },
  compactLabel: {
    fontSize: 13,
  },
});
