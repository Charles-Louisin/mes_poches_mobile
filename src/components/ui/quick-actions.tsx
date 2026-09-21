import { type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { color, space, type as font } from '@/theme/tokens';
import { GoldDiamond } from './gold-diamond';
import { IconCircle, iconToneColor } from './icon-circle';
import { PressScale } from './press-scale';

export function QuickActions({
  items,
}: {
  items: {
    key: string;
    label: string;
    Icon: LucideIcon | ComponentType<{ color: string; size: number; strokeWidth?: number }>;
    onPress: () => void;
    tone?: 'primary' | 'success' | 'danger' | 'warning' | 'muted';
    premium?: boolean;
  }[];
}) {
  const { isPremium } = useAuth();
  return (
    <View style={styles.row}>
      {items.map((item) => {
        const tone = item.tone ?? 'primary';
        const Icon = item.Icon;
        const showDiamond = !!item.premium && !isPremium;
        return (
          <PressScale
            key={item.key}
            onPress={item.onPress}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={item.label}>
            <View>
              <IconCircle tone={tone} size={56}>
                <Icon color={iconToneColor(tone)} size={22} strokeWidth={2} />
              </IconCircle>
              {showDiamond ? (
                <View style={styles.gem}>
                  <GoldDiamond size={14} />
                </View>
              ) : null}
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: space[8],
  },
  gem: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  label: {
    fontFamily: font.sansMed,
    fontSize: 12,
    color: color.textSecondary,
    textAlign: 'center',
  },
});
