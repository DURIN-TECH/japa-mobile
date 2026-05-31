import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Typography, Card } from '@/components/ui/themed';
import { useTheme, cn } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/stores/onboarding.store';

export default function PassportQuestionScreen() {
  const { isDark } = useTheme();
  const setHasPassport = useOnboardingStore((state) => state.setHasPassport);

  const handleSelection = (hasPassport: boolean) => {
    setHasPassport(hasPassport);
    router.push('/(onboard)/country');
  };

  return (
    <Screen>
      <View className="flex-1 px-6 pt-12">
        {/* Progress indicator */}
        <View className="mb-8 flex-row">
          <View className="mr-2 h-1 flex-1 rounded-full bg-blue-500" />
          <View
            className={cn(
              'mr-2 h-1 flex-1 rounded-full',
              isDark ? 'bg-gray-700' : 'bg-gray-200',
            )}
          />
          <View
            className={cn(
              'mr-2 h-1 flex-1 rounded-full',
              isDark ? 'bg-gray-700' : 'bg-gray-200',
            )}
          />
          <View
            className={cn(
              'h-1 flex-1 rounded-full',
              isDark ? 'bg-gray-700' : 'bg-gray-200',
            )}
          />
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text
            className={cn(
              'text-3xl font-bold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            Welcome to JAPA
          </Text>
          <Typography variant="body" color="muted" className="mt-2">
            Let&apos;s get you set up. First, a quick question:
          </Typography>
        </View>

        {/* Question */}
        <View className="mb-6">
          <Typography variant="h3" className="mb-6">
            Do you currently have a valid passport?
          </Typography>
        </View>

        {/* Options */}
        <View className="gap-4">
          <TouchableOpacity onPress={() => handleSelection(true)}>
            <Card className="flex-row items-center p-4">
              <View
                className={cn(
                  'mr-4 h-12 w-12 items-center justify-center rounded-full',
                  isDark ? 'bg-green-900/30' : 'bg-green-100',
                )}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.success}
                />
              </View>
              <View className="flex-1">
                <Typography variant="body" className="font-semibold">
                  Yes, I have a passport
                </Typography>
                <Typography variant="caption" color="muted">
                  Great! You&apos;re ready to explore visa options
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Card>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleSelection(false)}>
            <Card className="flex-row items-center p-4">
              <View
                className={cn(
                  'mr-4 h-12 w-12 items-center justify-center rounded-full',
                  isDark ? 'bg-orange-900/30' : 'bg-orange-100',
                )}
              >
                <Ionicons name="time" size={24} color={colors.warning} />
              </View>
              <View className="flex-1">
                <Typography variant="body" className="font-semibold">
                  Not yet
                </Typography>
                <Typography variant="caption" color="muted">
                  No problem! You can still explore and plan
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Card>
          </TouchableOpacity>
        </View>

        {/* Info note */}
        <View className="mt-auto pb-8">
          <Card className={cn('p-4', isDark ? 'bg-blue-900/20' : 'bg-blue-50')}>
            <View className="flex-row items-start">
              <Ionicons
                name="information-circle"
                size={20}
                color={colors.primary}
                className="mr-2"
              />
              <Typography
                variant="caption"
                color="muted"
                className="ml-2 flex-1"
              >
                You&apos;ll need a valid passport to apply for most visas. If
                you don&apos;t have one yet, we can help guide you through the
                process.
              </Typography>
            </View>
          </Card>
        </View>
      </View>
    </Screen>
  );
}
