import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Button } from '@/components/ui/themed';

export default function NotFoundScreen() {
  const { isDark } = useTheme();

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-5">
        <Text
          className={cn(
            'mb-4 text-2xl font-bold',
            isDark ? 'text-white' : 'text-gray-900',
          )}
        >
          This screen doesn&apos;t exist.
        </Text>
        <Link href="/" asChild>
          <Button>Go to home screen</Button>
        </Link>
      </View>
    </Screen>
  );
}
