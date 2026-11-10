import { type ReactNode, type RefObject } from 'react';
import {
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
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
  scrollRef,
  keyboardAware: _keyboardAware,
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
  scrollRef?: RefObject<ScrollViewInstance | null>;
  /** Conservé pour les écrans qui le passaient déjà. Le remontage est toujours actif. */
  keyboardAware?: boolean;
}) {
  const keyboardInset = useKeyboardBottomInset();
  const body = enter ? (
    <Animated.View entering={FadeIn.duration(480)} style={scroll ? undefined : styles.flex}>
      {children}
    </Animated.View>
  ) : (
    children
  );

  const inner = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[padded && styles.pad, { paddingBottom: 48, flexGrow: 1 }]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="none"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.primary} />
        ) : undefined
      }>
      {body}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.pad]}>{body}</View>
  );

  return (
    <View style={[styles.root, style]}>
      <SafeAreaView
        style={[styles.flex, keyboardInset > 0 && { paddingBottom: keyboardInset }]}
        edges={edges}>
        {inner}
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
