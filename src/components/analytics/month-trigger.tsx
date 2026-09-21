import { StyleSheet, Text } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { PressScale } from '@/components/ui/press-scale';
import { color, radius, type as font } from '@/theme/tokens';

export function MonthTrigger({
  label,
  onPress,
  inline,
}: {
  label: string;
  onPress: () => void;
  inline?: boolean;
}) {
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Mois : ${label}. Changer de mois`}
      style={[styles.btn, inline && styles.inline]}>
      <Text style={styles.label}>{label}</Text>
      <ChevronDown color={color.primary} size={inline ? 16 : 18} strokeWidth={2.2} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: color.primaryLight,
    marginBottom: 16,
  },
  label: {
    fontFamily: font.sansSemi,
    fontSize: 15,
    color: color.primary,
    textTransform: 'capitalize',
  },
  inline: {
    alignSelf: 'flex-start',
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
