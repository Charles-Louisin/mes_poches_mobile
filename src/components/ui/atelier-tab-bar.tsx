import { useEffect } from 'react';
import { BottomTabBarProps } from 'expo-router/tabs';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Home, History, Wallet, LayoutGrid, Plus, Tags, BarChart3 } from 'lucide-react-native';
import { color, radius, type as font } from '@/theme/tokens';
import { TutorialTarget } from '@/components/tutorial/tutorial-target';
import { PressScale } from './press-scale';
import { track } from '@/lib/telemetry';

const LEFT = [
  { name: 'index', label: 'Accueil', Icon: Home, target: 'tab-home' },
  { name: 'transactions', label: 'Historique', Icon: History, target: 'tab-transactions' },
  { name: 'categories', label: 'Catég.', Icon: Tags, target: 'tab-categories' },
] as const;

const RIGHT = [
  { name: 'wallets', label: 'Poches', Icon: Wallet, target: 'tab-wallets' },
  { name: 'analytics', label: 'Analyse', Icon: BarChart3, target: 'tab-analytics' },
  { name: 'plus', label: 'Plus', Icon: LayoutGrid, target: 'tab-plus' },
] as const;

export function AtelierTabBar({
  state,
  navigation,
  onCompose,
}: BottomTabBarProps & { onCompose: () => void }) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row}>
        {LEFT.map((item) => (
          <TutorialTarget key={item.name} id={item.target} style={{ flex: 1 }}>
            <TabItem
              label={item.label}
              Icon={item.Icon}
              active={current === item.name}
              onPress={() => {
                track('click', { screen: item.name, props: { element: 'tab' } });
                if (item.name === 'transactions') {
                  navigation.navigate('transactions', { screen: 'index' });
                } else {
                  navigation.navigate(item.name);
                }
              }}
            />
          </TutorialTarget>
        ))}

        <PressScale
          scaleTo={0.92}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            track('click', { screen: 'compose', props: { element: 'fab' } });
            onCompose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Ajouter une transaction"
          style={styles.fabHit}>
          <View style={styles.fab}>
            <Plus color={color.white} size={26} strokeWidth={2.4} />
          </View>
        </PressScale>

        {RIGHT.map((item) => (
          <TutorialTarget key={item.name} id={item.target} style={{ flex: 1 }}>
            <TabItem
              label={item.label}
              Icon={item.Icon}
              active={current === item.name}
              onPress={() => {
                track('click', { screen: item.name, props: { element: 'tab' } });
                if (item.name === 'wallets') {
                  navigation.navigate('wallets', { screen: 'index' });
                } else {
                  navigation.navigate(item.name);
                }
              }}
            />
          </TutorialTarget>
        ))}
      </View>
    </View>
  );
}

function TabItem({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: typeof Home;
  active: boolean;
  onPress: () => void;
}) {
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 210 });
  }, [active, on]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + on.value * 0.08 }],
  }));

  return (
    <PressScale
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={styles.item}>
      <Animated.View style={iconStyle}>
        <Icon color={active ? color.primary : color.textMuted} size={20} strokeWidth={active ? 2.4 : 2} />
      </Animated.View>
      <Animated.Text style={[styles.caption, { color: active ? color.primary : color.textMuted }]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: color.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 2,
    minHeight: 48,
  },
  caption: {
    fontFamily: font.sansMed,
    fontSize: 9,
  },
  fabHit: { paddingHorizontal: 2, paddingBottom: 8 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
});
