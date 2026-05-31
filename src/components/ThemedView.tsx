import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    {
      light: lightColor,
      dark: darkColor,
    },
    'background',
  );

  return (
    <View
      className="mx-2 mb-3 rounded-lg p-2"
      style={[{ backgroundColor }, style]}
      {...otherProps}
    />
  );
}
