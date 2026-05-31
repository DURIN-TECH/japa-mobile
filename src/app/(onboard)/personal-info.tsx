import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Screen, Typography, Card, Input } from '@/components/ui/themed';
import { useTheme, cn } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useAuthStore } from '@/stores/auth.store';

export default function PersonalInfoScreen() {
  const { isDark } = useTheme();
  const setPersonalInfo = useOnboardingStore((state) => state.setPersonalInfo);
  const getData = useOnboardingStore((state) => state.getData);
  const { completeOnboarding, isLoading, error, clearError } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const isValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  const handleContinue = async () => {
    if (!isValid) return;

    clearError();
    setPersonalInfo(firstName.trim(), lastName.trim());

    const data = {
      ...getData(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };

    const success = await completeOnboarding(data);
    if (success) {
      router.replace('/(onboard)/complete');
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-12">
          {/* Progress indicator */}
          <View className="mb-8 flex-row">
            <View className="mr-2 h-1 flex-1 rounded-full bg-blue-500" />
            <View className="mr-2 h-1 flex-1 rounded-full bg-blue-500" />
            <View className="mr-2 h-1 flex-1 rounded-full bg-blue-500" />
            <View
              className={cn(
                'h-1 flex-1 rounded-full',
                isDark ? 'bg-gray-700' : 'bg-gray-200',
              )}
            />
          </View>

          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Typography color="primary">← Back</Typography>
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-6">
            <Text
              className={cn(
                'text-2xl font-bold',
                isDark ? 'text-white' : 'text-gray-900',
              )}
            >
              What&apos;s your name?
            </Text>
            <Typography variant="body" color="muted" className="mt-2">
              Enter your name as it appears on your passport or ID
            </Typography>
          </View>

          {/* Error */}
          {error && (
            <Card className="mb-4 border-red-500/50 bg-red-500/10">
              <Typography color="error">{error}</Typography>
            </Card>
          )}

          {/* Form */}
          <View className="gap-4">
            <View>
              <Typography variant="caption" color="muted" className="mb-2">
                First Name
              </Typography>
              <Input
                placeholder="Enter your first name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
              />
            </View>

            <View>
              <Typography variant="caption" color="muted" className="mb-2">
                Last Name
              </Typography>
              <Input
                placeholder="Enter your last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
              />
            </View>
          </View>

          {/* Continue button */}
          <View className="mt-auto pb-8 pt-4">
            <TouchableOpacity
              onPress={handleContinue}
              disabled={!isValid || isLoading}
              className={cn(
                'items-center rounded-xl py-4',
                isValid && !isLoading
                  ? 'bg-blue-500'
                  : isDark
                    ? 'bg-gray-700'
                    : 'bg-gray-300',
              )}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  className={cn(
                    'font-semibold',
                    isValid ? 'text-white' : 'text-gray-500',
                  )}
                >
                  Complete Setup
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
