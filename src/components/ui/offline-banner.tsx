import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flushOfflineQueue } from '@/lib/offline-queue';
import { isOnline, subscribeOnline } from '@/lib/network';
import { color, type as font } from '@/theme/tokens';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    void isOnline().then((now) => {
      setOnline(now);
      wasOffline.current = !now;
    });
    return subscribeOnline((now) => {
      setOnline(now);
      if (now && wasOffline.current) {
        setFlash(true);
        setTimeout(() => setFlash(false), 5000);
        void flushOfflineQueue();
      }
      wasOffline.current = !now;
    });
  }, []);

  if (online && !flash) return null;

  return (
    <View style={[styles.bar, online ? styles.ok : styles.off, { paddingTop: 8 + Math.max(insets.top - 8, 0) }]}>
      <Text style={styles.text}>
        {online ? 'Connexion rétablie — synchronisation…' : 'Hors ligne — les saisies et détections sont enregistrées localement'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  off: { backgroundColor: color.surfaceSecondary },
  ok: { backgroundColor: '#E7F8EF' },
  text: { fontFamily: font.sansMed, fontSize: 12, color: color.text, textAlign: 'center' },
});
