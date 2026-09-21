import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';

/** Petite illustration 3D d’un diamant doré — marqueur Premium (plan gratuit). */
export function GoldDiamond({ size = 16 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  const top = `gdTop${uid}`;
  const left = `gdLeft${uid}`;
  const right = `gdRight${uid}`;
  const shine = `gdShine${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="Premium">
      <Defs>
        <LinearGradient id={top} x1="8" y1="2" x2="24" y2="14" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFF4C8" />
          <Stop offset="1" stopColor="#E8C45A" />
        </LinearGradient>
        <LinearGradient id={left} x1="4" y1="10" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F3D57A" />
          <Stop offset="1" stopColor="#C4921A" />
        </LinearGradient>
        <LinearGradient id={right} x1="16" y1="10" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#D4A017" />
          <Stop offset="1" stopColor="#8A5A0A" />
        </LinearGradient>
        <LinearGradient id={shine} x1="10" y1="4" x2="18" y2="16" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points="16,3 28,12 16,29 4,12" fill="#C4921A" />
      <Polygon points="16,3 4,12 16,14" fill={`url(#${top})`} />
      <Polygon points="16,3 28,12 16,14" fill="#E0B43A" />
      <Polygon points="4,12 16,14 16,29" fill={`url(#${left})`} />
      <Polygon points="28,12 16,14 16,29" fill={`url(#${right})`} />
      <Path d="M16 3 L10 12 L16 14 Z" fill={`url(#${shine})`} />
    </Svg>
  );
}
