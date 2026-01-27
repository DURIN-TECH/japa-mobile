import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Screen, Button, Typography } from '@/components/ui/themed';
import { useTheme, cn } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useAuthStore } from '@/stores/auth.store';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingCompleteScreen() {
  const { isDark, colors } = useTheme();
  const resetOnboarding = useOnboardingStore((state) => state.reset);
  const finalizeOnboarding = useAuthStore((state) => state.finalizeOnboarding);
  const profile = useAuthStore((state) => state.profile);

  // Clean up onboarding data
  useEffect(() => {
    resetOnboarding();
  }, [resetOnboarding]);

  const handleGetStarted = () => {
    // This will set onboardingCompleted to true in the store,
    // which triggers the useProtectedRoute hook to redirect to tabs
    finalizeOnboarding();
  };

  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-6">
        {/* Success icon */}
        <View className={cn(
          'mb-8 h-24 w-24 items-center justify-center rounded-full',
          isDark ? 'bg-green-900/30' : 'bg-green-100'
        )}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        </View>

        {/* Message */}
        <Text className={cn('mb-2 text-center text-3xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
          You&apos;re all set!
        </Text>

        <Typography variant="body" color="muted" className="mb-8 text-center">
          Welcome{profile?.firstName ? `, ${profile.firstName}` : ''}! Your account is ready. Start exploring visa options and begin your journey.
        </Typography>

        {/* Features preview */}
        <View className="mb-8 w-full gap-3">
          <View className="flex-row items-center">
            <Ionicons name="search" size={20} color={colors.primary} />
            <Typography variant="body" className="ml-3">
              Browse visa options for 50+ countries
            </Typography>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="document-text" size={20} color={colors.primary} />
            <Typography variant="body" className="ml-3">
              Track your applications in real-time
            </Typography>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="cloud-upload" size={20} color={colors.primary} />
            <Typography variant="body" className="ml-3">
              Upload and manage documents securely
            </Typography>
          </View>
        </View>

        {/* CTA */}
        <Button onPress={handleGetStarted} className="w-full">
          <Text className="font-semibold text-white">Get Started</Text>
        </Button>
      </View>
    </Screen>
  );
}
