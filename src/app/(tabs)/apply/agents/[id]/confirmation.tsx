/**
 * Confirmation Screen
 *
 * Step 3 of the consultation booking flow: success confirmation.
 * Shows booking details and navigation options.
 *
 * INTEGRATION CHANGE: Replaced mock `verificationAgents` lookup
 * with `useAgent()` hook for agent name display.
 *
 * Backend endpoint: GET /agents/:id
 */

import { useLocalSearchParams, router } from 'expo-router';
import { View, ScrollView, Text, ActivityIndicator } from 'react-native';
import { CheckCircle2, Calendar, Clock, CreditCard } from 'lucide-react-native';
import { format } from 'date-fns';
import { useAgent } from '@/hooks/useAgents';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Section, Card, Button } from '@/components/ui/themed';

type ConfirmationParams = {
  id: string;
  type: 'consultation' | 'visa';
  date: string;
  time: string;
  paymentMethod: string;
} & { [key: string]: string | string[] };

export default function ConfirmationScreen() {
  const params = useLocalSearchParams<ConfirmationParams>();
  const { id, type, date, time, paymentMethod } = params;
  const { isDark, colors } = useTheme();

  // Fetch agent from API instead of mock array
  const { data: apiAgent, isLoading } = useAgent(id);

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!apiAgent) return null;

  const handleViewDetails = () => {
    if (type === 'consultation') {
      router.replace({
        pathname: '/(tabs)/me/consultations' as const,
      });
    } else {
      router.replace({
        pathname: '/(tabs)/me/applications' as const,
      });
    }
  };

  const handleReturnHome = () => {
    router.replace({
      pathname: '/(tabs)' as const,
    });
  };

  return (
    <Screen>
      <ScrollView className="flex-1">
        {/* Success Message */}
        <View
          className={cn(
            'items-center px-4 py-8',
            isDark ? 'bg-gray-800' : 'bg-white',
          )}
        >
          <View
            className={cn(
              'mb-4 h-16 w-16 items-center justify-center rounded-full',
              isDark ? 'bg-green-900/50' : 'bg-green-100',
            )}
          >
            <CheckCircle2 size={32} color="#16a34a" />
          </View>
          <Text
            className={cn(
              'mb-2 text-center text-2xl font-bold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {type === 'consultation'
              ? 'Consultation Booked!'
              : 'Application Started!'}
          </Text>
          <Text
            className={cn(
              'text-center',
              isDark ? 'text-gray-400' : 'text-gray-600',
            )}
          >
            {type === 'consultation'
              ? 'Your consultation has been successfully scheduled'
              : 'Your visa application has been initiated'}
          </Text>
        </View>

        {/* Details */}
        <Section>
          <Card>
            <View className="mb-4 flex-row items-center">
              <Calendar size={20} color={colors.iconMuted} />
              <Text
                className={cn('ml-2', isDark ? 'text-white' : 'text-gray-900')}
              >
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
            <View className="mb-4 flex-row items-center">
              <Clock size={20} color={colors.iconMuted} />
              <Text
                className={cn('ml-2', isDark ? 'text-white' : 'text-gray-900')}
              >
                {time}
              </Text>
            </View>
            <View className="flex-row items-center">
              <CreditCard size={20} color={colors.iconMuted} />
              <Text
                className={cn('ml-2', isDark ? 'text-white' : 'text-gray-900')}
              >
                Paid with {paymentMethod}
              </Text>
            </View>
          </Card>
        </Section>

        {/* Navigation Options */}
        <Section title="What's Next?">
          <Button className="mb-3" onPress={handleViewDetails}>
            {type === 'consultation'
              ? 'View My Consultations'
              : 'View My Applications'}
          </Button>

          <Button variant="outline" onPress={handleReturnHome}>
            Return to Home
          </Button>
        </Section>
      </ScrollView>
    </Screen>
  );
}
