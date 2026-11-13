/**
 * MES POCHES — design system
 * Blanc respirant, bleu logo, cartes arrondies, fintech premium.
 */

export const color = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#EEF4FF',
  primaryVeryLight: '#F5F8FF',

  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceSecondary: '#F2F4F5',

  text: '#111111',
  textSecondary: '#707070',
  textMuted: '#9A9A9A',

  border: '#E7E7E7',

  success: '#12B76A',
  warning: '#F5A623',
  danger: '#F04438',
  info: '#20B8D5',

  white: '#FFFFFF',

  /** Aliases — anciens noms atelier, mappés au thème clair. */
  void: '#FFFFFF',
  canvas: '#FFFFFF',
  raised: '#F8F9FA',
  inset: '#F2F4F5',
  blotter: '#FFFFFF',
  line: '#E7E7E7',
  lineStrong: '#E7E7E7',
  brass: '#2563EB',
  brassDeep: '#1D4ED8',
  brassMute: '#9A9A9A',
  ivory: '#111111',
  mist: '#707070',
  ember: '#F04438',
  moss: '#12B76A',
  paper: '#F8F9FA',
  paperDeep: '#F2F4F5',
  ink: '#111111',
  inkMute: '#707070',
  wax: '#2563EB',
} as const;

export const space = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screen: 24,
} as const;

export const type = {
  display: 'Outfit_700Bold',
  displayItalic: 'Outfit_700Bold',
  sans: 'Outfit_400Regular',
  sansMed: 'Outfit_500Medium',
  sansSemi: 'Outfit_600SemiBold',
  sansBold: 'Outfit_700Bold',
} as const;

export const typeScale = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: type.sansBold },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: type.sansBold },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: type.sansBold },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: type.sansSemi },
  body: { fontSize: 16, lineHeight: 24, fontFamily: type.sans },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontFamily: type.sansMed },
  caption: { fontSize: 14, lineHeight: 20, fontFamily: type.sans },
  small: { fontSize: 12, lineHeight: 16, fontFamily: type.sans },
} as const;

export const radius = {
  hair: 10,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  small: 10,
  medium: 14,
  card: 20,
  largeCard: 24,
  button: 28,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#111111',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  soft: {
    shadowColor: '#111111',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export const motion = {
  /** Retour de pression : ressort court, sans rebond perceptible. */
  spring: { duration: 260, dampingRatio: 0.9 },
  slow: { duration: 420, dampingRatio: 1 },
  page: 320,
  fade: 240,
  press: 120,
  /** Panneaux glissants : courbe des feuilles iOS. */
  sheetOpen: { duration: 340, dampingRatio: 0.88 },
  sheetCloseMs: 240,
  /** Écran de démarrage : le temps d'afficher le logo, sans faire attendre. */
  minLoad: 600,
  /** Décalage max cumulé des entrées en cascade. */
  staggerCap: 240,
} as const;
