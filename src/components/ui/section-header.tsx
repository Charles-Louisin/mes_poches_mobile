import { StyleSheet, Text, View } from 'react-native';
import { color, type as font, typeScale } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && onPress ? (
        <PressScale onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={styles.action}>{action}</Text>
        </PressScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    ...typeScale.h3,
    color: color.text,
  },
  action: {
    fontFamily: font.sansMed,
    fontSize: 14,
    color: color.primary,
  },
});
