import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius } from '@/theme/tokens';

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'muted';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: color.primaryLight, fg: color.primary },
  success: { bg: '#EFFFF5', fg: color.success },
  danger: { bg: '#FEF3F2', fg: color.danger },
  warning: { bg: '#FFF7E8', fg: color.warning },
  muted: { bg: color.surfaceSecondary, fg: color.textSecondary },
};

export function IconCircle({
  children,
  tone = 'primary',
  size = 44,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor: t.bg },
        style,
      ]}>
      {children}
    </View>
  );
}

export const iconToneColor = (tone: Tone = 'primary') => TONES[tone].fg;

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

