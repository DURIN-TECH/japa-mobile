import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { FileStack, House, User2 } from 'lucide-react-native';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useSettingsStore } from '@/stores/settings.store';

export default function TabLayout() {
  const isDark = useSettingsStore((state) => state.isDark());

  const colors = {
    tint: isDark ? '#fff' : '#2563eb',
    tabBarBackground: isDark ? '#1f2937' : '#fff',
    tabBarBorder: isDark ? '#374151' : '#e5e7eb',
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: colors.tabBarBackground,
            borderTopColor: colors.tabBarBorder,
          },
          default: {
            backgroundColor: colors.tabBarBackground,
            borderTopColor: colors.tabBarBorder,
          },
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <House size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="apply"
        options={{
          title: 'Apply',
          tabBarIcon: ({ color }) => <FileStack size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color }) => <User2 size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
