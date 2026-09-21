import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

const webSafeArea = {
  frame: { x: 0, y: 0, width: PHONE_WIDTH, height: PHONE_HEIGHT },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.device}>
        <SafeAreaProvider initialMetrics={webSafeArea} style={styles.fill}>
          {children}
        </SafeAreaProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F4F5',
  },
  device: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    maxWidth: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
  },
  fill: {
    flex: 1,
  },
});
