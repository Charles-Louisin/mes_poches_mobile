import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PhoneFrame } from '@/components/phone-frame';
import { AuthProvider } from '@/contexts/auth';
import { ConfirmProvider } from '@/contexts/confirm';
import { CurrencyProvider } from '@/contexts/currency';
import { ReceiptScanProvider } from '@/contexts/receipt-scan';
import { ToastProvider } from '@/contexts/toast';
import { SessionGuard } from '@/components/session-guard';
import { TutorialProvider } from '@/contexts/tutorial';
import { TutorialOverlay } from '@/components/tutorial/tutorial-overlay';
import { VoiceNoteProvider } from '@/contexts/voice-note';
import { AppQueryProvider } from '@/lib/query';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { TelemetryListener } from '@/components/telemetry-listener';
import { PendingDuplicateListener } from '@/components/pending-duplicate-listener';
import { color } from '@/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, 700);
    return () => clearTimeout(t);
  }, [loaded]);

  if (!loaded) return null;

  const tree = (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.background }}>
      <AppQueryProvider>
        <AuthProvider>
          <CurrencyProvider>
            <ToastProvider>
              <SessionGuard>
              <TutorialProvider>
              <ConfirmProvider>
                <ReceiptScanProvider>
                  <VoiceNoteProvider>
                    <StatusBar style="dark" />
                    <OfflineBanner />
                    <TelemetryListener />
                    <PendingDuplicateListener />
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: color.background },
                        animation: 'slide_from_right',
                        animationDuration: 560,
                      }}>
                      <Stack.Screen name="index" options={{ animation: 'none' }} />
                      <Stack.Screen name="onboarding" options={{ animation: 'fade', animationDuration: 560 }} />
                      <Stack.Screen name="capture-setup" options={{ animation: 'fade', animationDuration: 480 }} />
                      <Stack.Screen name="(auth)" options={{ animation: 'fade', animationDuration: 520 }} />
                      <Stack.Screen name="auth/google" options={{ animation: 'fade', animationDuration: 400 }} />
                      <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: 560 }} />
                      <Stack.Screen name="+not-found" options={{ animation: 'fade', animationDuration: 400 }} />
                      <Stack.Screen
                        name="pending"
                        options={{ animation: 'slide_from_bottom', animationDuration: 520 }}
                      />
                      <Stack.Screen
                        name="subscription"
                        options={{ animation: 'slide_from_bottom', animationDuration: 520 }}
                      />
                      <Stack.Screen name="objectifs" />
                      <Stack.Screen name="settings" />
                      <Stack.Screen name="profile" />
                      <Stack.Screen name="about" options={{ animation: 'fade', animationDuration: 480 }} />
                    </Stack>
                  </VoiceNoteProvider>
                </ReceiptScanProvider>
              </ConfirmProvider>
              <TutorialOverlay />
              </TutorialProvider>
              </SessionGuard>
            </ToastProvider>
          </CurrencyProvider>
        </AuthProvider>
      </AppQueryProvider>
    </GestureHandlerRootView>
  );

  if (Platform.OS === 'web') return <PhoneFrame>{tree}</PhoneFrame>;
  return tree;
}
