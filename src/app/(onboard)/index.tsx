import { View, Text } from 'react-native';
import { Screen, Button, Typography } from '@/components/ui/themed';
import { useTheme, cn } from '@/hooks/useTheme';

export default function OnboardingScreen() {
  const { isDark } = useTheme();

  // TODO: Implement full onboarding flow in Phase 2
  // This is a placeholder that will be replaced with:
  // - Passport question
  // - Country selection
  // - Personal info
  // - Complete

  return (
    <Screen>
      <View className="flex-1 justify-center px-6">
        <View className="items-center">
          <Text className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Welcome to JAPA
          </Text>
          <Typography variant="body" color="muted" className="mt-4 text-center">
            Let&apos;s set up your profile to get started with your visa journey.
          </Typography>
        </View>

        <View className="mt-12">
          <Typography variant="h3" className="mb-4">
            Coming in Phase 2:
          </Typography>
          <Typography color="muted">• Passport information</Typography>
          <Typography color="muted">• Country selection</Typography>
          <Typography color="muted">• Personal details</Typography>
          <Typography color="muted">• Profile completion</Typography>
        </View>

        {/* Temporary: Skip onboarding for testing */}
        <Button
          variant="outline"
          className="mt-8"
          onPress={() => {
            // This would normally complete onboarding via API
            console.log('Onboarding will be implemented in Phase 2');
          }}
        >
          <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Continue (Phase 2)
          </Text>
        </Button>
      </View>
    </Screen>
  );
}
