import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { stopBatchJob, trackBatchJob } from 'sms-monitor';
import { transactionApi, type BatchJobStatus } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';
import { useToast } from '@/contexts/toast';
import { color, type as font } from '@/theme/tokens';

/**
 * Enregistrement en lot suivi en arrière-plan.
 * Le pourcentage vient du serveur (lignes réellement enregistrées) : l'anneau affiche le vrai avancement.
 * Android : la même progression est affichée dans les notifications, l'app fermée ou non.
 */
type Ctx = { start: (job: BatchJobStatus) => void; running: boolean };
const BatchCtx = createContext<Ctx>({ start: () => undefined, running: false });

export function useBatchProgress() {
  return useContext(BatchCtx);
}

const SIZE = 56;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function Ring({ percent, done, total }: { percent: number; done: number; total: number }) {
  const insets = useSafeAreaInsets();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(percent / 100, { duration: 600, easing: EASE_OUT }));
  }, [p, percent]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.get()) }));
  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 8 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Enregistrement en cours : ${percent} %, ${done} sur ${total}`}>
      <View style={styles.badge}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={color.primaryLight} strokeWidth={STROKE} fill={color.white} />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={color.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            animatedProps={props}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text style={styles.pct}>
          {percent}
          <Text style={styles.sign}>%</Text>
        </Text>
      </View>
      <Text style={styles.caption}>
        {done}/{total}
      </Text>
    </Animated.View>
  );
}

export function BatchProgressProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [job, setJob] = useState<BatchJobStatus | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(
    async (final: BatchJobStatus) => {
      setJob(null);
      void stopBatchJob();
      await invalidateFinance();
      if (final.failed === 0) toast(`${final.done} transaction${final.done > 1 ? 's' : ''} enregistrée${final.done > 1 ? 's' : ''}`, 'ok');
      else
        toast(
          `${final.done} enregistrée${final.done > 1 ? 's' : ''}, ${final.failed} en échec : ${final.errors[0]?.message ?? 'erreur'}`,
          'err'
        );
    },
    [toast]
  );

  const poll = useCallback(
    async (id: string) => {
      try {
        const next = await transactionApi.batchStatus(id);
        if (next.status === 'done') {
          await finish(next);
          return;
        }
        setJob(next);
      } catch {
        /* réseau coupé : on réessaie */
      }
      timer.current = setTimeout(() => void poll(id), 1000);
    },
    [finish]
  );

  const start = useCallback(
    (initial: BatchJobStatus) => {
      if (!initial.id) return;
      if (timer.current) clearTimeout(timer.current);
      setJob(initial);
      void trackBatchJob(initial.id);
      timer.current = setTimeout(() => void poll(initial.id!), 700);
    },
    [poll]
  );

  // Retour au premier plan : rattrape immédiatement l'avancement réel.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && job?.id) {
        if (timer.current) clearTimeout(timer.current);
        void poll(job.id);
      }
    });
    return () => sub.remove();
  }, [job?.id, poll]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <BatchCtx.Provider value={{ start, running: !!job }}>
      {children}
      {job ? <Ring percent={job.percent} done={job.done + job.failed} total={job.total} /> : null}
    </BatchCtx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 14, alignItems: 'center', zIndex: 1000, elevation: 12 },
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
    shadowColor: '#111111',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  pct: { fontFamily: font.sansBold, fontSize: 15, color: color.text, fontVariant: ['tabular-nums'] },
  sign: { fontFamily: font.sansMed, fontSize: 10, color: color.textSecondary },
  caption: {
    marginTop: 4,
    fontFamily: font.sansSemi,
    fontSize: 11,
    color: color.primaryDark,
    backgroundColor: color.white,
    paddingHorizontal: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
