// ─────────────────────────────────────────────────────────────────────────────
// Destination Explorer — 5-tab shell (Home / Explore / Tracker / Agents / Profile)
// (4 tabs, no Agents, in a self-service-only build: japa#334)
//
// Custom glass bottom tab bar matching the prototype's shell.jsx TabBar: warm
// translucent blur, coral active state with a tinted icon fill, safe-area aware.
// ─────────────────────────────────────────────────────────────────────────────

import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { EX } from '@/components/explorer/theme';
import { Ic, IcName } from '@/components/explorer/icons';
// Self-service-only launch flag (japa#334): drops the Agents tab.
import { isSelfServiceOnly } from '@/config/env';

// Props Expo Router hands a custom `tabBar` renderer. Expo Router 58 (SDK 58,
// japa#399) no longer passes `navigation`: the bar gets `emitter` (fires
// `tabPress`) and `navigateToTab(routeKey)`. Typed with the library's own
// type, with no cast, so tsc catches the next change to this contract.
type TabBarProps = BottomTabBarProps;

// Tab order + icons mirror the prototype exactly.
const TAB_META: { name: string; label: string; icon: IcName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'explore', label: 'Explore', icon: 'globe' },
  { name: 'tracker', label: 'Tracker', icon: 'layers' },
  { name: 'agents', label: 'Agents', icon: 'users' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

// ── Self-service-only build (japa#334) ─────────────────────────────────────
// The Agents tab is a hidden feature, so the bar shows four tabs (Home,
// Explore, Tracker, Profile). Its route still exists (no code is deleted);
// the root guard in src/app/_layout.tsx redirects `/agents` to Home. With the
// flag off all five tabs show, as before.
export function visibleTabs(selfServiceOnly: boolean) {
  return selfServiceOnly
    ? TAB_META.filter((m) => m.name !== 'agents')
    : TAB_META;
}

export function GlassTabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  // Tabs the bar may draw; routes not listed render no button.
  const tabs = visibleTabs(isSelfServiceOnly());
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
          const meta = tabs.find((m) => m.name === route.name);
          if (!meta) return null;
          const focused = state.index === index;
          const IconCmp = Ic[meta.icon];
          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            // Same contract as the stock bar: tabPress can be prevented by a
            // listener; otherwise switch to the tab by its route key.
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              // e2e (Maestro, japa#361): `tab.home`, `tab.agents`, … and the
              // tab's selected state for assistive tech / flow assertions.
              // No visual effect.
              testID={`tab.${meta.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
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
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      {TAB_META.map((m) => (
        <Tabs.Screen key={m.name} name={m.name} />
      ))}
    </Tabs>
  );
}
