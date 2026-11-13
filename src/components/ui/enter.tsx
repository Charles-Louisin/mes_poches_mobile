import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { motion } from '@/theme/tokens';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Wrapper : l’animation d’entrée est sur l’enfant pour ne pas écraser l’opacity du layout. */
export function Enter({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return (
    <View>
      <Animated.View
        entering={FadeInDown.delay(Math.min(delay, motion.staggerCap)).duration(motion.fade).easing(EASE_OUT)}>
        {children}
      </Animated.View>
    </View>
  );
}
