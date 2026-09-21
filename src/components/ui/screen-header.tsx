import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { color, radius, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function ScreenHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: boolean;
  action?: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(280).springify().damping(20)} style={styles.row}>
      {back ? (
        <PressScale
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour">
          <ChevronLeft color={color.text} size={24} strokeWidth={2} />
        </PressScale>
      ) : (
        <View style={styles.slot} />
      )}
      <Animated.Text entering={FadeIn.delay(60).duration(280)} style={styles.title} numberOfLines={1}>
        {title}
      </Animated.Text>
      <View style={styles.right}>{action}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    minHeight: 44,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: { width: 40, height: 40 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.sansSemi,
    fontSize: 18,
    color: color.text,
    marginHorizontal: 8,
  },
  right: { width: 40, alignItems: 'flex-end' },
});
