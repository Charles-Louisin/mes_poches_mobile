import { StyleSheet, Text, View } from 'react-native';
import { Image as ImageIcon, Mic, Type } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScanArt } from '@/components/illustrations';
import { useAuth } from '@/contexts/auth';
import { color, radius, type as font } from '@/theme/tokens';
import { GoldDiamond } from './gold-diamond';
import { IconCircle, iconToneColor } from './icon-circle';
import { PressScale } from './press-scale';
import { track } from '@/lib/telemetry';
import { Sheet } from './sheet';

export function ComposeSheet({
  open,
  onClose,
  onText,
  onImage,
  onAudio,
  imageDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onText: () => void;
  onImage: () => void;
  onAudio: () => void;
  imageDisabled?: boolean;
}) {
  const { isPremium } = useAuth();
  const cells = [
    { key: 'text', Icon: Type, title: 'Saisie', hint: 'Montant à la main', tone: 'primary' as const, onPress: onText, disabled: false, pro: false },
    {
      key: 'image',
      Icon: ImageIcon,
      title: 'Scan',
      hint: imageDisabled ? 'Analyse en cours…' : 'Ticket',
      tone: 'warning' as const,
      onPress: onImage,
      disabled: !!imageDisabled,
      pro: true,
    },
    { key: 'audio', Icon: Mic, title: 'Voix', hint: 'Note vocale', tone: 'success' as const, onPress: onAudio, disabled: false, pro: true },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle opération">
      <View style={styles.hero}>
        <ScanArt size={96} />
      </View>
      <Text style={styles.lede}>Saisissez, scannez un reçu ou dictez. Rien n’est enregistré sans votre validation.</Text>
      <View style={styles.grid}>
        {cells.map(({ key, Icon, title, hint, tone, onPress, disabled, pro }, i) => (
          <Animated.View
            key={key}
            entering={FadeInDown.delay(50 + i * 50).springify().damping(17)}
            style={styles.cellWrap}>
            <PressScale
              onPress={() => {
                track('click', { screen: 'compose', props: { element: key } });
                onPress();
              }}
              disabled={disabled}
              scaleTo={0.94}
              style={[styles.cell, disabled && styles.cellOff]}
              accessibilityLabel={title}>
              <View style={styles.cellTop}>
                <IconCircle tone={tone} size={48}>
                  <Icon color={iconToneColor(tone)} size={22} strokeWidth={2} />
                </IconCircle>
                {pro && !isPremium ? <GoldDiamond size={16} /> : null}
              </View>
              <Text style={styles.cellTitle}>{title}</Text>
              <Text style={styles.cellHint}>{hint}</Text>
            </PressScale>
          </Animated.View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lede: {
    fontFamily: font.sans,
    color: color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  hero: { alignItems: 'center', marginBottom: 8 },
  grid: { flexDirection: 'row', gap: 10 },
  cellWrap: { flex: 1 },
  cell: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: 14,
    gap: 8,
    minHeight: 128,
    alignItems: 'flex-start',
  },
  cellOff: { opacity: 0.45 },
  cellTitle: { fontFamily: font.sansSemi, color: color.text, fontSize: 14 },
  cellTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', alignSelf: 'stretch' },
  cellHint: { fontFamily: font.sans, color: color.textMuted, fontSize: 11, lineHeight: 15 },
});
