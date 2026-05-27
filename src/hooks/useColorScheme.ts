import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' | null | undefined {
  const scheme = useRNColorScheme();
  return scheme === 'unspecified' ? null : scheme;
}
