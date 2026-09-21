import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { authApi } from '@/lib/api';
import { completeGoogleDeepLink } from '@/lib/google-native';
import { getToken } from '@/lib/secure-token';
import { color, type as font } from '@/theme/tokens';

export default function GoogleAuthReturnScreen() {
  const { completeGoogleSession, token } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    const code = typeof params.code === 'string' ? params.code : '';
    if (!code) {
      const wait = setTimeout(() => {
        if (!ran.current) router.replace(token ? '/(tabs)' : '/(auth)/login');
      }, 2500);
      return () => clearTimeout(wait);
    }
    ran.current = true;
    const timeout = setTimeout(() => {
      router.replace(token ? '/(tabs)' : '/(auth)/login');
    }, 20_000);
    void (async () => {
      try {
        const payload = await completeGoogleDeepLink(
          `mespoches://auth/google?code=${encodeURIComponent(code)}`
        );
        if (!payload) {
          const existing = getToken();
          if (existing) {
            try {
              const me = await authApi.me();
              await completeGoogleSession({ user: me, token: existing });
              router.replace('/(tabs)');
              return;
            } catch {
              /* continue */
            }
          }
          router.replace(token ? '/(tabs)' : '/(auth)/login');
          return;
        }
        await completeGoogleSession(payload);
        router.replace('/(tabs)');
      } catch {
        const existing = getToken();
        if (existing) {
          try {
            const me = await authApi.me();
            await completeGoogleSession({ user: me, token: existing });
            router.replace('/(tabs)');
            return;
          } catch {
            /* ignore */
          }
        }
        router.replace(token ? '/(tabs)' : '/(auth)/login');
      } finally {
        clearTimeout(timeout);
      }
    })();
  }, [completeGoogleSession, params.code, token]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={color.primary} />
      <Text style={styles.label}>Finalisation Google…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: color.background },
  label: { fontFamily: font.sans, color: color.textSecondary, fontSize: 14 },
});
