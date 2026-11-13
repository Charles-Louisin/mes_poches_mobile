import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  // Largeur utile en « points de texte » : un grand réglage de police réduit l'espace comme un petit écran.
  const effective = width / Math.max(1, fontScale);
  const isSmall = effective < 360;
  const isLarge = width >= 430;
  return {
    width,
    height,
    isSmall,
    isLarge,
    /** Marge latérale : plus de place au contenu sur les petits écrans, sans le coller aux bords. */
    pad: effective < 330 ? 14 : isSmall ? 16 : isLarge ? 24 : 20,
    maxAmount: isSmall ? 36 : isLarge ? 44 : 40,
  };
}
