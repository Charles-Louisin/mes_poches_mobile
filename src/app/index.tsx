import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { BootSplash } from '@/components/brand/boot-splash';
import { isMoneyCaptureEnabled } from '@/lib/sms-monitor';
import { HOME_STEPS, fetchHomeData } from '@/lib/home-data';
import { getQueryClient } from '@/lib/query';

/** Au-delà, on entre quand même : l'accueil finira de se charger lui-même. */
const PREFETCH_MAX_MS = 6000;

export default function Gate() {
  const { ready, bootStage, token, isPremium, onboardingSeen, captureSetupSeen } = useAuth();
  const [steps, setSteps] = useState(0);
  const [label, setLabel] = useState('');
  const [prefetched, setPrefetched] = useState(false);
  const [entered, setEntered] = useState(false);
  const started = useRef(false);

  const needsCapture = Platform.OS === 'android' && isMoneyCaptureEnabled() && !captureSetupSeen;
  const goingHome = ready && !!token && onboardingSeen && !needsCapture;

  // Données de l'accueil chargées pendant l'écran de démarrage : l'accueil s'affiche déjà rempli.
  useEffect(() => {
    if (!goingHome || started.current) return;
    started.current = true;
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, PREFETCH_MAX_MS));
    const load = getQueryClient()
      .fetchQuery({
        queryKey: ['home', isPremium],
        queryFn: () =>
          fetchHomeData(isPremium, (stepLabel) => {
            setSteps((n) => n + 1);
            setLabel(stepLabel);
          }),
      })
      .catch(() => undefined);
    void Promise.race([load, timeout]).then(() => setPrefetched(true));
  }, [goingHome, isPremium]);

  // Progression réelle : session lue (1) + compte vérifié (1) + requêtes de l'accueil.
  // Le total est connu dès la session lue (jeton présent) : la barre n'a jamais à « attendre » un recalcul.
  const expectsHome = !!token && onboardingSeen && !needsCapture;
  const total = 2 + (expectsHome ? HOME_STEPS : 0);
  const done = (bootStage !== 'storage' || ready ? 1 : 0) + (ready ? 1 : 0) + (goingHome ? steps : 0);
  const finished = ready && (!goingHome || prefetched);
  const progress = finished ? 1 : done / total;
  const caption = !ready
    ? bootStage === 'account'
      ? 'Vérification de votre compte'
      : 'Ouverture de votre session'
    : goingHome
      ? label || 'Préparation de l’accueil'
      : 'Prêt';

  const onExited = useCallback(() => setEntered(true), []);

  if (!entered) {
    return <BootSplash progress={progress} label={caption} exiting={finished} onExited={onExited} />;
  }

  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (needsCapture) return <Redirect href="/capture-setup" />;
  return <Redirect href="/(tabs)" />;
}
