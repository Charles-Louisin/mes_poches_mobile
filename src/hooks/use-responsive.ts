import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360;
  const isLarge = width >= 430;
  return {
    width,
    height,
    isSmall,
    isLarge,
    pad: isSmall ? 20 : 24,
    maxAmount: isSmall ? 36 : isLarge ? 44 : 40,
  };
}
