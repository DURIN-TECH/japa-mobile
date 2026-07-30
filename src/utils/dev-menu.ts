import { Alert } from 'react-native';
import { registerDevMenuItems } from 'expo-dev-menu';
import { router } from 'expo-router';

import { useSettingsStore } from '@/stores/settings.store';

// Registers custom items in the Expo dev client menu (cmd+D on iOS sim,
// cmd+M on Android emulator, or shake on device). Dev-only — guarded by __DEV__.
export function registerDevMenu() {
  if (!__DEV__) return;

  registerDevMenuItems([
    {
      name: 'Reset settings store',
      shouldCollapse: true,
      callback: () => {
        useSettingsStore.persist.clearStorage();
        useSettingsStore.setState({
          themePreference: 'system',
          notificationsEnabled: true,
          language: 'en',
          hasSeenIntro: false,
        });
        console.log('Settings store reset to defaults');
        Alert.alert('Settings cleared', 'Persisted settings have been reset.');
      },
    },
    {
      name: 'Go to Explorer welcome',
      shouldCollapse: true,
      callback: () => {
        router.replace('/(auth)/welcome');
      },
    },
  ]);
}
