import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { BootSplash } from '@/components/brand/boot-splash';
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
  if (Platform.OS === 'android' && !captureSetupSeen) return <Redirect href="/capture-setup" />;
  if (!token) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)" />;
}
