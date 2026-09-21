import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { color, space, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  last,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      style={[styles.row, last && styles.last]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.meta}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress ? <ChevronRight color={color.textMuted} size={18} strokeWidth={2} /> : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingVertical: 14,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  last: { borderBottomWidth: 0 },
  icon: { width: 36, alignItems: 'center' },
  meta: { flex: 1, minWidth: 0 },
  title: { fontFamily: font.sansMed, fontSize: 16, color: color.text },
  sub: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, marginTop: 2 },
  value: { fontFamily: font.sans, fontSize: 14, color: color.textSecondary, marginRight: 4 },
});
