import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { color, space } from '@/theme/tokens';

export function Screen({
  children,
  scroll,
  padded = true,
  edges = ['top'],
  style,
  onRefresh,
  refreshing,
  backdrop: _backdrop = false,
  enter = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  onRefresh?: () => void;
  refreshing?: boolean;
  backdrop?: boolean;
  enter?: boolean;
}) {
  const body = enter ? (
    <Animated.View style={styles.grow}>
      <Animated.View entering={FadeIn.duration(480)} style={styles.grow}>
        {children}
      </Animated.View>
    </Animated.View>
  ) : (
    children
  );

  return (
    <View style={[styles.root, style]}>
      <SafeAreaView style={styles.flex} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[padded && styles.pad, { paddingBottom: 48, flexGrow: 1 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={color.primary}
                />
              ) : undefined
            }>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.flex, padded && styles.pad]}>{body}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  pad: { paddingHorizontal: space.screen, paddingTop: 8 },
});
