import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';
type SystemColorScheme = 'light' | 'dark' | null | undefined;

interface SettingsState {
  // Theme
  themePreference: ThemePreference;
  systemColorScheme: SystemColorScheme;
  setThemePreference: (preference: ThemePreference) => void;
  setSystemColorScheme: (scheme: SystemColorScheme) => void;

  // Notifications
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;

  // Language
  language: string;
  setLanguage: (language: string) => void;

  // Computed
  getColorScheme: () => ColorScheme;
  isDark: () => boolean;

  // Hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Theme
      themePreference: 'system',
      systemColorScheme: 'light',
      setThemePreference: (preference) => set({ themePreference: preference }),
      setSystemColorScheme: (scheme) => set({ systemColorScheme: scheme }),

      // Notifications
      notificationsEnabled: true,
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),

      // Language
      language: 'en',
      setLanguage: (language) => set({ language }),

      // Computed
      getColorScheme: () => {
        const state = get();
        if (state.themePreference === 'system') {
          return state.systemColorScheme ?? 'light';
        }
        return state.themePreference;
      },
      isDark: () => get().getColorScheme() === 'dark',

      // Hydration
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'japa-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themePreference: state.themePreference,
        notificationsEnabled: state.notificationsEnabled,
        language: state.language,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// Hook to wait for hydration
export const useSettingsHydration = () => {
  return useSettingsStore((state) => state._hasHydrated);
};
