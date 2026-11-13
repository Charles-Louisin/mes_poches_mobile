import { Stack } from 'expo-router';
import { color } from '@/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.background },
        animation: 'slide_from_right',
        animationDuration: 320,
      }}>
      <Stack.Screen name="login" options={{ animation: 'fade', animationDuration: 340 }} />
      <Stack.Screen name="verify-email" options={{ animation: 'slide_from_bottom', animationDuration: 340 }} />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="two-factor" />
    </Stack>
  );
}
