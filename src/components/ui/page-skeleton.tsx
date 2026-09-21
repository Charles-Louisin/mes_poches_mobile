import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color, radius } from '@/theme/tokens';

type Variant = 'list' | 'cards' | 'pending' | 'home' | 'goals';

export function PageSkeleton({
  variant = 'list',
  rows = 4,
}: {
  variant?: Variant;
  rows?: number;
}) {
  if (variant === 'home') {
    return (
      <View style={styles.wrap}>
        <Bone height={92} radius={radius.card} />
        <View style={{ height: 16 }} />
        <Bone height={72} radius={radius.card} />
        <View style={{ height: 20 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <Bone height={88} radius={radius.card} />
          </View>
        ))}
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={`row-${i}`} style={styles.row}>
            <Bone width={40} height={40} radius={radius.pill} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bone height={14} width="62%" />
              <Bone height={12} width="38%" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'cards') {
    return (
      <View style={styles.wrap}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <Bone height={96} radius={radius.card} />
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'pending') {
    return (
      <View style={styles.wrap}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={styles.pendingCard}>
            <Bone height={12} width="34%" />
            <Bone height={22} width="46%" />
            <Bone height={14} width="70%" />
            <Bone height={12} width="52%" />
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'goals') {
    return (
      <View style={styles.wrap}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={{ marginBottom: 16 }}>
            <View style={styles.row}>
              <Bone height={14} width="42%" />
              <Bone height={14} width="28%" />
            </View>
            <View style={{ height: 10 }} />
            <Bone height={14} radius={radius.pill} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Bone width={40} height={40} radius={radius.pill} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone height={14} width="64%" />
            <Bone height={12} width="40%" />
          </View>
          <Bone height={14} width={56} />
        </View>
      ))}
    </View>
  );
}

function Bone({
  width = '100%',
  height,
  radius: r = radius.md,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 720 }), -1, true);
  }, [opacity]);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: color.surfaceSecondary,
        },
        anim,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pendingCard: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
});
