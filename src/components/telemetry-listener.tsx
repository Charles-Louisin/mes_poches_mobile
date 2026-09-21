import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { AppState } from 'react-native';
import { screenFromPath, track } from '@/lib/telemetry';

/** Enregistre les vues d’écran et les sessions pour la console admin. */
export function TelemetryListener() {
  const pathname = usePathname();
  const last = useRef('');

  useEffect(() => {
    const screen = screenFromPath(pathname);
    if (screen === last.current) return;
    last.current = screen;
    track('screen_view', { screen });
  }, [pathname]);

  useEffect(() => {
    track('session_start', { screen: 'app' });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        track('session_start', { screen: last.current || 'app' });
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
