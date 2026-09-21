import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressScale({
  children,
  style,
  disabled,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        scale.value = withSpring(scaleTo, motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
      style={[anim, style]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
