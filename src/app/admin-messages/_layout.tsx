import { Stack } from 'expo-router';
import { color } from '@/theme/tokens';

export default function AdminMessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
