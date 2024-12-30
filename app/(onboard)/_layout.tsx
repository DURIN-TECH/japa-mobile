import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useColorScheme, View } from 'react-native';

export default function OnboardingLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
      // <Stack screenOptions={{
      //   headerShown: true,
      //   contentStyle: { backgroundColor: 'transparent' },
      //   headerTitleStyle: { color: theme.colors.text },
      //   headerBackVisible: true,
      //   headerBackButtonDisplayMode: 'minimal',
      //   headerTintColor: theme.colors.text,
      //   headerStyle: { backgroundColor: 'transparent' },
      //   headerShadowVisible: false,
      //   headerBackButtonMenuEnabled: true,
    // }}/>
    <Stack>
      {/* <Stack.Screen name="index" options={{ headerShown: false }} /> */}
    </Stack>
  );
}