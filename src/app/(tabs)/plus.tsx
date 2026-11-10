import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  ChevronRight,
  ClipboardCheck,
  Inbox,
  Info,
  MessageCircle,
  Settings,
  Smartphone,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { color, type as font } from '@/theme/tokens';
import { isMoneyCaptureEnabled } from '@/lib/sms-monitor';
import { track } from '@/lib/telemetry';

type LinkItem = { href: string; label: string; hint: string; Icon: LucideIcon; pro?: boolean };

const LINKS: LinkItem[] = [
  { href: '/objectifs', label: 'Objectifs', hint: 'Budgets, épargne, récurrences', Icon: Target, pro: true },
  { href: '/pending', label: 'À valider', hint: 'Tickets, dictées, propositions', Icon: ClipboardCheck },
  { href: '/capture-setup', label: 'Détection mobile money', hint: 'Autoriser la lecture des notifications', Icon: Smartphone },
  { href: '/settings', label: 'Réglages', hint: 'Compte, sécurité, export', Icon: Settings },
  { href: '/feedback', label: 'Votre avis', hint: 'Bugs, idées, retours d’usage', Icon: MessageCircle },
  { href: '/about', label: 'À propos', hint: 'Mentions légales, Mes Poches', Icon: Info },
];

export default function PlusScreen() {
  const { isPremium, user } = useAuth();
  const visible = LINKS.filter((item) => item.href !== '/capture-setup' || isMoneyCaptureEnabled());
  const settingsAt = visible.findIndex((item) => item.href === '/settings');
  const insertAt = settingsAt >= 0 ? settingsAt + 1 : visible.length;
  const links: LinkItem[] = [
    ...visible.slice(0, insertAt),
    ...(user?.role === 'admin'
      ? [{ href: '/admin-messages', label: 'Messages reçus', hint: 'Retours des utilisateurs', Icon: Inbox }]
      : []),
    ...visible.slice(insertAt),
  ];
  return (
    <Screen scroll>
      <Text style={styles.title}>Outils et compte</Text>
      {links.map((item, i) => (
        <PressScale
          key={item.href}
          onPress={() => {
            track('click', { screen: 'plus', props: { element: item.href.replace(/^\//, '') } });
            router.push(item.href as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${item.label}, ${item.hint}`}
          style={[styles.row, i === 0 && { borderTopWidth: 0 }]}>
          <View style={styles.ico}>
            <item.Icon color={color.primary} size={20} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{item.label}</Text>
              {item.pro && !isPremium ? <GoldDiamond size={16} /> : null}
            </View>
            <Text style={styles.hint}>{item.hint}</Text>
          </View>
          <ChevronRight color={color.textMuted} size={18} />
        </PressScale>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: 30, color: color.text, marginTop: 6, marginBottom: 20, lineHeight: 36 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    gap: 14,
  },
  ico: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: font.sansSemi, fontSize: 17, color: color.text },
  hint: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 2 },
});
