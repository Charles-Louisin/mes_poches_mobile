import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/auth';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { color, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

const LINKS = [
  { href: '/objectifs', label: 'Objectifs', hint: 'Budgets, épargne, récurrences', pro: true },
  { href: '/pending', label: 'À valider', hint: 'SMS, tickets, dictées' },
  { href: '/settings', label: 'Réglages', hint: 'Devise, export, compte' },
  { href: '/about', label: 'À propos', hint: 'Mentions légales, Mes Poches' },
] as const;

export default function PlusScreen() {
  const { isPremium } = useAuth();
  return (
    <Screen scroll>
      <Text style={styles.kicker}>Plus</Text>
      <Text style={styles.title}>Outils{'\n'}et compte</Text>
      {LINKS.map((item, i) => (
        <PressScale
          key={item.href}
          onPress={() => {
            track('click', { screen: 'plus', props: { element: item.href.replace(/^\//, '') } });
            router.push(item.href as never);
          }}
          style={[styles.row, i === 0 && { borderTopWidth: 0 }]}>
          <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{item.label}</Text>
              {'pro' in item && item.pro && !isPremium ? <GoldDiamond size={16} /> : null}
            </View>
            <Text style={styles.hint}>{item.hint}</Text>
          </View>
        </PressScale>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: font.sansMed, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: color.brassMute },
  title: { fontFamily: font.displayItalic, fontSize: 34, color: color.ivory, marginTop: 6, marginBottom: 24, lineHeight: 38 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, gap: 16 },
  num: { fontFamily: font.display, fontSize: 16, color: color.brassMute, width: 28, marginTop: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: font.sansSemi, fontSize: 17, color: color.ivory },
  hint: { fontFamily: font.sans, fontSize: 13, color: color.mist, marginTop: 4 },
});
