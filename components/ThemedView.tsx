import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({
    light: lightColor,
    dark: darkColor
  }, 'background');

  return <View className="mb-3 mx-2 p-2 rounded-lg" style={[{ backgroundColor }, style]} {...otherProps} />;
}
