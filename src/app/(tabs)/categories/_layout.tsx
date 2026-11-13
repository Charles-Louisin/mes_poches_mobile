import { Stack } from 'expo-router';
import { color } from '@/theme/tokens';

export default function CategoriesStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.background },
        animation: 'slide_from_right',
        animationDuration: 320,
      }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="new" options={{ animation: 'slide_from_bottom', animationDuration: 340 }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
