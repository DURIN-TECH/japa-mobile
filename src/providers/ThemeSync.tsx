import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores/settings.store';

export function ThemeSync({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const setSystemColorScheme = useSettingsStore(
    (state) => state.setSystemColorScheme,
  );

  useEffect(() => {
    setSystemColorScheme(systemColorScheme);
  }, [systemColorScheme, setSystemColorScheme]);

  return <>{children}</>;
}
