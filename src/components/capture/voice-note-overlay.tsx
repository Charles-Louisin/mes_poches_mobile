import { useMemo } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Mic, Trash2, X } from 'lucide-react-native';
import { AudioLoader } from '@/components/capture/audio-loader';
import { Button } from '@/components/ui/button';
import { PressScale } from '@/components/ui/press-scale';
import { color, radius, type as font } from '@/theme/tokens';

export type VoicePhase = 'idle' | 'holding' | 'cancelling' | 'processing';

const SWIPE_CANCEL = 72;

export function VoiceNoteOverlay({
  open,
  phase,
  onClose,
  onBeginHold,
  onEndHold,
  onSwipeCancel,
  onStopProcessing,
}: {
  open: boolean;
  phase: VoicePhase;
  onClose: () => void;
  onBeginHold: () => void;
  onEndHold: (cancelled: boolean) => void;
  onSwipeCancel: () => void;
  onStopProcessing: () => void;
}) {
  const translateX = useSharedValue(0);
  const cancelling = useSharedValue(false);

  const composed = useMemo(() => {
    const hold = Gesture.LongPress()
      .minDuration(80)
      .maxDistance(1000)
      .onStart(() => {
        cancelling.value = false;
        translateX.value = 0;
        runOnJS(onBeginHold)();
      })
      .onFinalize(() => {
        const didCancel = cancelling.value;
        translateX.value = withSpring(0);
        cancelling.value = false;
        runOnJS(onEndHold)(didCancel);
      });

    const pan = Gesture.Pan()
      .minDistance(0)
      .onUpdate((e) => {
        const x = Math.max(0, e.translationX);
        translateX.value = x;
        const next = x > SWIPE_CANCEL;
        if (next && !cancelling.value) {
          cancelling.value = true;
          runOnJS(onSwipeCancel)();
        } else if (!next && cancelling.value) {
          cancelling.value = false;
        }
      });

    return Gesture.Simultaneous(hold, pan);
  }, [cancelling, onBeginHold, onEndHold, onSwipeCancel, translateX]);

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!open) return null;

  const holding = phase === 'holding' || phase === 'cancelling';
  const processing = phase === 'processing';
  const willCancel = phase === 'cancelling';

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={processing ? onStopProcessing : onClose}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.dim}>
          <View style={styles.card}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Note vocale</Text>
                <Text style={styles.sub}>
                  {processing
                    ? 'Analyse de l’audio…'
                    : willCancel
                      ? 'Relâchez pour supprimer'
                      : holding
                        ? 'Parlez — relâchez pour valider'
                        : 'Maintenez pour parler'}
                </Text>
              </View>
              <PressScale
                onPress={processing ? onStopProcessing : onClose}
                accessibilityLabel={processing ? 'Arrêter' : 'Fermer'}
                style={styles.close}>
                <X color={color.textMuted} size={18} />
              </PressScale>
            </View>

            <View style={styles.stage}>
              {processing ? (
                <>
                  <View style={styles.loaderWrap}>
                    <AudioLoader active large />
                  </View>
                  <Text style={styles.hint}>Extraction des montants et des libellés…</Text>
                </>
              ) : (
                <>
                  <View style={styles.swipeRow}>
                    <GestureDetector gesture={composed}>
                      <Animated.View
                        collapsable={false}
                        style={[
                          styles.mic,
                          holding ? styles.micLive : styles.micIdle,
                          willCancel ? styles.micCancel : null,
                          micStyle,
                        ]}
                        accessibilityLabel="Maintenir pour parler, glisser à droite pour annuler"
                        accessibilityRole="button">
                        <Mic color={color.white} size={28} />
                      </Animated.View>
                    </GestureDetector>
                    <View style={[styles.trash, willCancel ? styles.trashOn : null]}>
                      <Trash2 color={willCancel ? color.danger : color.textMuted} size={20} />
                    </View>
                  </View>
                  <AudioLoader active={holding} />
                  <Text style={styles.hint}>
                    {willCancel
                      ? 'Glissement à droite — cette prise sera effacée'
                      : 'Glissez vers la droite pour supprimer et recommencer'}
                  </Text>
                </>
              )}
            </View>

            {processing ? (
              <Button label="Arrêter le traitement" variant="secondary" onPress={onStopProcessing} />
            ) : null}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.55)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: color.white,
    borderRadius: radius.largeCard,
    padding: 20,
    gap: 16,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  sub: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 4 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', gap: 14, paddingVertical: 8 },
  swipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 88,
  },
  mic: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIdle: { backgroundColor: color.primary },
  micLive: { backgroundColor: color.danger },
  micCancel: { backgroundColor: color.textMuted },
  loaderWrap: {
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trash: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  trashOn: { backgroundColor: '#FDECEC' },
  hint: {
    fontFamily: font.sans,
    fontSize: 12,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
