import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { BootSplash } from '@/components/brand/boot-splash';
import { isMoneyCaptureEnabled } from '@/lib/sms-monitor';
import { motion } from '@/theme/tokens';

export default function Gate() {
  const { ready, token, onboardingSeen, captureSetupSeen } = useAuth();
  const [hold, setHold] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setHold(false), motion.minLoad);
    return () => clearTimeout(t);
  }, []);

  if (!ready || hold) {
    return <BootSplash />;
  }

  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (Platform.OS === 'android' && isMoneyCaptureEnabled() && !captureSetupSeen) {
    return <Redirect href="/capture-setup" />;
  }
  return <Redirect href="/(tabs)" />;
}
