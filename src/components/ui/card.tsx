import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, shadow, space } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <View style={[styles.card, padded && styles.pad, style]}>{children}</View>
  );

  if (onPress) {
    return (
      <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {body}
      </PressScale>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(17,17,17,0.05)' }
      : shadow.card),
  },
  pad: {
    padding: space[16],
  },
});
