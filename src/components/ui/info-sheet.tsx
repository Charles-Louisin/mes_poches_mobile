import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { color, radius, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';
import { Sheet } from './sheet';

export type InfoContent = {
  title: string;
  /** Ce que fait la fonctionnalité, en une phrase. */
  what: string;
  /** Comment s'en servir : étapes courtes. */
  how: string[];
  /** Titre de la liste (« Comment s’en servir » par défaut). */
  howTitle?: string;
};

/** Panneau d'explication ouvert par l'icône « i » d'un titre de section. */
export function InfoSheet({ open, onClose, info }: { open: boolean; onClose: () => void; info: InfoContent }) {
  return (
    <Sheet open={open} onClose={onClose} title={info.title}>
      <Text style={styles.what}>{info.what}</Text>
      <Text style={styles.howT}>{info.howTitle ?? 'Comment s’en servir'}</Text>
      <View style={styles.steps}>
        {info.how.map((step, i) => (
          <View key={step} style={styles.step}>
            <Text style={styles.n}>{i + 1}</Text>
            <Text style={styles.stepT}>{step}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

/**
 * Titre de section : nom, bouton « i » (explication), compteur et action principale à droite.
 * L'action est un vrai bouton nommé, jamais une icône seule.
 */
export function SectionTitle({
  title,
  info,
  count,
  action,
}: {
  title: string;
  info?: InfoContent;
  count?: number;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.head}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {typeof count === 'number' && count > 0 ? (
        <View style={styles.count}>
          <Text style={styles.countT}>{count}</Text>
        </View>
      ) : null}
      {info ? (
        <PressScale
          onPress={() => setOpen(true)}
          hitSlop={10}
          style={styles.info}
          accessibilityRole="button"
          accessibilityLabel={`À quoi sert : ${title}`}>
          <Info color={color.primary} size={17} strokeWidth={2.2} />
        </PressScale>
      ) : null}
      <View style={{ flex: 1 }} />
      {action}
      {info ? <InfoSheet open={open} onClose={() => setOpen(false)} info={info} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 32, marginBottom: 14 },
  title: { fontFamily: font.sansBold, fontSize: 20, lineHeight: 26, color: color.text, flexShrink: 1 },
  count: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countT: { fontFamily: font.sansSemi, fontSize: 12, color: color.textSecondary },
  info: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  what: { fontFamily: font.sansMed, fontSize: 16, lineHeight: 24, color: color.text, marginBottom: 20 },
  howT: { fontFamily: font.sansSemi, fontSize: 15, color: color.text, marginBottom: 12 },
  steps: { gap: 14, marginBottom: 8 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  n: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 24,
    backgroundColor: color.primaryLight,
    color: color.primaryDark,
    fontFamily: font.sansSemi,
    fontSize: 12,
  },
  stepT: { flex: 1, fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.textSecondary },
});
