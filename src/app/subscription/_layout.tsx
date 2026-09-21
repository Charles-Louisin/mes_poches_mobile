import { Stack } from 'expo-router';
import { color } from '@/theme/tokens';

export default function SubscriptionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.background },
        animation: 'slide_from_right',
        animationDuration: 560,
      }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="payment" />
      <Stack.Screen name="success" options={{ animation: 'fade', animationDuration: 480 }} />
    </Stack>
  );
}
