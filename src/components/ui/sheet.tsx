import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { color, radius, type as font } from '@/theme/tokens';

const OPEN_SPRING = { damping: 22, stiffness: 118, mass: 1.15 };
const CLOSE = { duration: 420, easing: Easing.out(Easing.cubic) };
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 780;
const WINDOW_H = Dimensions.get('window').height;
const SHEET_MAX_H = WINDOW_H * 0.72;
const BODY_MAX_H = WINDOW_H * 0.58;

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const keyboardInset = useKeyboardBottomInset();
  const [mounted, setMounted] = useState(false);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const height = useSharedValue(Dimensions.get('window').height * 0.55);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (open) {
      drag.value = 0;
      progress.value = 0;
      setMounted(true);
    } else {
      progress.value = withTiming(0, CLOSE, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
  }, [drag, open, progress, unmount]);

  useEffect(() => {
    if (mounted && open) progress.value = withSpring(1, OPEN_SPRING);
  }, [mounted, open, progress]);

  const pan = Gesture.Pan()
    .activeOffsetY(16)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (drag.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        drag.value = withSpring(0, OPEN_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * height.value + drag.value },
    ],
  }));

  const dimStyle = useAnimatedStyle(() => {
    const pulled = Math.min(1, drag.value / 260);
    return { opacity: progress.value * (1 - pulled * 0.7) };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height + 48;
  };

  if (!mounted) return null;

  return (
    <Modal transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, dimStyle]}>
          <Pressable style={styles.dim} onPress={onClose} />
        </Animated.View>
        <View style={[styles.kav, keyboardInset > 0 && { paddingBottom: keyboardInset }]} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, sheetStyle]} onLayout={onLayout}>
            <GestureDetector gesture={pan}>
              <View style={styles.header}>
                <View style={styles.handle} />
                {title ? <Text style={styles.title}>{title}</Text> : null}
              </View>
            </GestureDetector>
            <ScrollView
              style={styles.body}
              bounces={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator
              nestedScrollEnabled>
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.35)' },
  sheet: {
    backgroundColor: color.white,
    borderTopLeftRadius: radius.largeCard,
    borderTopRightRadius: radius.largeCard,
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 10,
    maxHeight: SHEET_MAX_H,
  },
  header: {
    paddingBottom: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.border,
    marginBottom: 16,
  },
  title: {
    fontFamily: font.sansBold,
    fontSize: 22,
    color: color.text,
    marginBottom: 18,
  },
  body: {
    maxHeight: BODY_MAX_H,
  },
});
