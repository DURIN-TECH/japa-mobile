// ─────────────────────────────────────────────────────────────────────────────
// Destination Explorer — 5-tab shell (Home / Explore / Tracker / Agents / Profile)
//
// Custom glass bottom tab bar matching the prototype's shell.jsx TabBar: warm
// translucent blur, coral active state with a tinted icon fill, safe-area aware.
// ─────────────────────────────────────────────────────────────────────────────

import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { EX } from '@/components/explorer/theme';
import { Ic, IcName } from '@/components/explorer/icons';

// Minimal shape of the props Expo Router hands a custom `tabBar` renderer.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: {
      type: 'tabPress';
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

// Tab order + icons mirror the prototype exactly.
const TAB_META: { name: string; label: string; icon: IcName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'explore', label: 'Explore', icon: 'globe' },
  { name: 'tracker', label: 'Tracker', icon: 'layers' },
  { name: 'agents', label: 'Agents', icon: 'users' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

function GlassTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <BlurView
      intensity={40}
      tint="light"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: EX.color.glassWarm,
        borderTopWidth: 1,
        borderTopColor: EX.color.line06,
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 14,
          paddingTop: 9,
          paddingBottom: 4,
        }}
      >
        {state.routes.map((route, index) => {
          const meta = TAB_META.find((m) => m.name === route.name);
          if (!meta) return null;
          const focused = state.index === index;
          const IconCmp = Ic[meta.icon];
          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented)
              navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 4,
                paddingVertical: 6,
              }}
            >
              <IconCmp
                size={23}
                color={focused ? EX.color.primary : EX.color.muted}
                fill={focused ? EX.color.primaryTint14 : 'transparent'}
                strokeWidth={1.8}
              />
              <Text
                style={{
                  fontSize: 10.5,
                  letterSpacing: 0.1,
                  fontWeight: focused ? '700' : '600',
                  color: focused ? EX.color.primary : EX.color.muted,
                }}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

export default function ExplorerTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...(props as unknown as TabBarProps)} />}
    >
      {TAB_META.map((m) => (
        <Tabs.Screen key={m.name} name={m.name} />
      ))}
    </Tabs>
  );
}
