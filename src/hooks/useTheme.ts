import { useSettingsStore } from '@/stores/settings.store';

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;
  cardBorder: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Primary
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Status
  success: string;
  warning: string;
  error: string;

  // UI Elements
  border: string;
  divider: string;
  icon: string;
  iconMuted: string;

  // Input
  inputBackground: string;
  inputBorder: string;
  placeholder: string;
}

const lightColors: ThemeColors = {
  background: '#f9fafb', // gray-50
  backgroundSecondary: '#ffffff',
  card: '#ffffff',
  cardBorder: '#e5e7eb', // gray-200

  text: '#111827', // gray-900
  textSecondary: '#374151', // gray-700
  textMuted: '#6b7280', // gray-500

  primary: '#2563eb', // blue-600
  primaryLight: '#eff6ff', // blue-50
  primaryDark: '#1e40af', // blue-800

  success: '#16a34a', // green-600
  warning: '#ca8a04', // yellow-600
  error: '#dc2626', // red-600

  border: '#e5e7eb', // gray-200
  divider: '#f3f4f6', // gray-100
  icon: '#374151', // gray-700
  iconMuted: '#6b7280', // gray-500

  inputBackground: '#ffffff',
  inputBorder: '#e5e7eb', // gray-200
  placeholder: '#9ca3af', // gray-400
};

const darkColors: ThemeColors = {
  background: '#111827', // gray-900
  backgroundSecondary: '#1f2937', // gray-800
  card: '#1f2937', // gray-800
  cardBorder: '#374151', // gray-700

  text: '#f9fafb', // gray-50
  textSecondary: '#e5e7eb', // gray-200
  textMuted: '#9ca3af', // gray-400

  primary: '#3b82f6', // blue-500
  primaryLight: '#1e3a5f', // custom dark blue
  primaryDark: '#60a5fa', // blue-400

  success: '#22c55e', // green-500
  warning: '#eab308', // yellow-500
  error: '#ef4444', // red-500

  border: '#374151', // gray-700
  divider: '#374151', // gray-700
  icon: '#e5e7eb', // gray-200
  iconMuted: '#9ca3af', // gray-400

  inputBackground: '#374151', // gray-700
  inputBorder: '#4b5563', // gray-600
  placeholder: '#6b7280', // gray-500
};

export function useTheme() {
  const isDark = useSettingsStore((state) => state.isDark());
  const colors = isDark ? darkColors : lightColors;

  return {
    isDark,
    colors,
  };
}

// Utility function for conditional classNames
export function cn(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(' ');
}
