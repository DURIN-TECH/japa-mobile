import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' | null | undefined {
  // RN 0.88 (Expo SDK 58, japa#399): `useColorScheme()` now returns only
  // 'light' | 'dark' | null | undefined. The old 'unspecified' value no
  // longer exists (it is an override value only), so there is nothing to map.
  return useRNColorScheme();
}
