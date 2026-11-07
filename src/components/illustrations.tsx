/**
 * Illustrations 3D pastel originales Mes Poches (bleu logo).
 */
import { Image, View } from 'react-native';
import { useLocalImageSource } from '@/lib/local-image';

const SRC = {
  balance: require('../../assets/illustrations/onboard-balance.png'),
  capture: require('../../assets/illustrations/onboard-capture.png'),
  insights: require('../../assets/illustrations/onboard-insights.png'),
  premium: require('../../assets/illustrations/onboard-premium.png'),
  wallet: require('../../assets/illustrations/empty-wallet.png'),
  transactions: require('../../assets/illustrations/empty-transactions.png'),
  pending: require('../../assets/illustrations/empty-pending.png'),
  scan: require('../../assets/illustrations/empty-scan.png'),
} as const;

export type ArtName = keyof typeof SRC;

export function SoftArt({ name, size = 220 }: { name: ArtName; size?: number }) {
  const source = useLocalImageSource(SRC[name]);
  return (
    <View collapsable={false} style={{ width: size, height: size }}>
      {source ? (
        <Image
          source={source}
          style={{ width: size, height: size }}
          resizeMode="contain"
          fadeDuration={0}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
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
