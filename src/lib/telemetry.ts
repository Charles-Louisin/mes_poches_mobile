import { AppState, Platform } from 'react-native';
import { fetchApi } from './api-client';
import { getToken } from './secure-token';

type Props = Record<string, string | number | boolean | undefined>;

const queue: { name: string; screen?: string; props?: Props }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function flush() {
  timer = null;
  if (flushing) return;
  if (!getToken()) {
    if (queue.length) schedule(4000);
    return;
  }
  const batch = queue.splice(0, 40);
  if (!batch.length) return;
  flushing = true;
  void fetchApi('/telemetry/events', {
    method: 'POST',
    body: JSON.stringify({
      events: batch.map((e) => ({
        name: e.name,
        screen: e.screen || '',
        platform: Platform.OS,
        props: e.props || {},
      })),
    }),
  })
    .catch(() => {
      /* silencieux — ne jamais bloquer l’app */
    })
    .finally(() => {
      flushing = false;
      if (queue.length) schedule(400);
    });
}

let lastScreen = 'app';

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

export function flushTelemetry() {
  if (timer) clearTimeout(timer);
  flush();
}

/** Envoie un événement produit (clic, écran) vers la console admin. */
export function track(name: string, opts?: { screen?: string; props?: Props }) {
  const clean = name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 48);
  if (clean.length < 2) return;
  if (opts?.screen) lastScreen = opts.screen;
  if (queue.length >= 80) queue.splice(0, queue.length - 40);
  queue.push({ name: clean, screen: opts?.screen || lastScreen, props: opts?.props });
  if (queue.length >= 10) {
    flushTelemetry();
    return;
  }
  if (!timer) schedule(8000);
}

export function getLastScreen() {
  return lastScreen;
}

export function screenFromPath(pathname: string) {
  const raw = pathname.replace(/[()]/g, '').replace(/^\//, '').replace(/\//g, '_').toLowerCase();
  return (raw || 'home').replace(/[^a-z0-9_]/g, '').slice(0, 48);
}

AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') flushTelemetry();
});
