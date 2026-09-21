import { StyleSheet } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { color } from '@/theme/tokens';

/** Hachures fines sur les surfaces papier (livrets) — gravure, pas dégradé. */
export function PaperGrain({ opacity = 0.5 }: { opacity?: number }) {
  return (
    <Svg style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Defs>
        <Pattern id="hatch" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <Path d="M0,6 L6,0" stroke={color.ink} strokeOpacity="0.09" strokeWidth="0.5" />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#hatch)" />
    </Svg>
  );
}
