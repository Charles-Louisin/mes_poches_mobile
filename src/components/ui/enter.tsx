import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
      <Animated.View entering={FadeInDown.delay(delay).springify().damping(18)}>
        {children}
      </Animated.View>
    </View>
  );
}
