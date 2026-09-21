/**
 * Illustrations 3D pastel originales Mes Poches (bleu logo).
 */
import { useEffect } from 'react';
import { Image } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SRC = {
  balance: require('@/assets/illustrations/onboard-balance.png'),
  capture: require('@/assets/illustrations/onboard-capture.png'),
  insights: require('@/assets/illustrations/onboard-insights.png'),
  premium: require('@/assets/illustrations/onboard-premium.png'),
  wallet: require('@/assets/illustrations/empty-wallet.png'),
  transactions: require('@/assets/illustrations/empty-transactions.png'),
  pending: require('@/assets/illustrations/empty-pending.png'),
  scan: require('@/assets/illustrations/empty-scan.png'),
} as const;

export type ArtName = keyof typeof SRC;

export function SoftArt({ name, size = 220 }: { name: ArtName; size?: number }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      180,
      withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [y]);

  const float = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 + y.value * 12 }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size, overflow: 'visible' }, float]}>
      <Image source={SRC[name]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}

export function PocketArt({ size = 180 }: { size?: number }) {
  return <SoftArt name="wallet" size={size} />;
}

export function ReceiptArt({ size = 180 }: { size?: number }) {
  return <SoftArt name="transactions" size={size} />;
}

export function ScanArt({ size = 180 }: { size?: number }) {
  return <SoftArt name="scan" size={size} />;
}

export function BellArt({ size = 180 }: { size?: number }) {
  return <SoftArt name="pending" size={size} />;
}

export function CoinsArt({ size = 240 }: { size?: number }) {
  return <SoftArt name="balance" size={size} />;
}

export function WriteArt({ size = 240 }: { size?: number }) {
  return <SoftArt name="capture" size={size} />;
}

export function ChartArt({ size = 240 }: { size?: number }) {
  return <SoftArt name="insights" size={size} />;
}

export function GiftArt({ size = 240 }: { size?: number }) {
  return <SoftArt name="premium" size={size} />;
}
