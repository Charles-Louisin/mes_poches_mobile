import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { getPrivacyUrl, getWebUrl } from '@/lib/api-config';
import { effectiveVersion, installedVersion } from '@/lib/app-version';
import { color, type as font } from '@/theme/tokens';

export default function AboutScreen() {
  const web = getWebUrl();
  const [version, setVersion] = useState(installedVersion());
  useEffect(() => {
    void effectiveVersion().then(setVersion);
  }, []);
  return (
    <Screen scroll>
      <ScreenHeader title="À propos" back />
      <View style={styles.seal}>
        <BrandMark size={132} />
      </View>
      <Animated.Text entering={FadeInDown.delay(80).springify()} style={styles.mark}>
        Mes poches
      </Animated.Text>
      <Text style={styles.rule} />
      <Text style={styles.body}>
        Suivez votre cash et votre Mobile Money, poche par poche.
      </Text>
      <Text style={styles.body}>Version {version}</Text>
      <View style={{ gap: 12, marginTop: 12 }}>
        <Button
          label="Mentions légales"
          variant="line"
          onPress={() => void WebBrowser.openBrowserAsync(`${web}/legal/mentions`)}
        />
        <Button
          label="Politique de confidentialité"
          variant="line"
          onPress={() => void WebBrowser.openBrowserAsync(getPrivacyUrl())}
        />
        <Button
          label="Conditions d’utilisation"
          variant="line"
          onPress={() => void WebBrowser.openBrowserAsync(`${web}/legal/terms`)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seal: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
  mark: { fontFamily: font.displayItalic, fontSize: 40, color: color.brass, textAlign: 'center' },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.lineStrong,
    marginVertical: 24,
  },
  body: { fontFamily: font.sans, fontSize: 16, lineHeight: 24, color: color.mist, marginBottom: 16 },
});
