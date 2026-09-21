import { StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { ScanArt } from '@/components/illustrations';
import { Button } from '@/components/ui/button';
import { color, type as font } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.wrap}>
        <ScanArt size={220} />
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>Page introuvable</Text>
        <Text style={styles.body}>
          Cette page n’existe pas, ou le lien est périmé. Rien n’a été perdu : vos poches sont toujours à l’accueil.
        </Text>
        <View style={styles.cta}>
          <Button label="Retour à l’accueil" onPress={() => router.replace('/(tabs)')} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  code: {
    marginTop: 8,
    fontFamily: font.sansBold,
    fontSize: 42,
    color: color.primary,
    letterSpacing: 2,
  },
  title: {
    marginTop: 4,
    fontFamily: font.sansBold,
    fontSize: 22,
    color: color.text,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.textSecondary,
    textAlign: 'center',
  },
  cta: { marginTop: 24, width: '100%', maxWidth: 320 },
});
