import { useLocalSearchParams, router } from 'expo-router';
import { View, ScrollView, Text } from 'react-native';
import { CheckCircle2, Calendar, Clock, CreditCard } from 'lucide-react-native';
import { format } from 'date-fns';
import { verificationAgents } from '@/mock_data/agents';
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

  const agent = verificationAgents.find((a) => a.id === id);
  if (!agent) return null;

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
            className={cn('text-center', isDark ? 'text-gray-400' : 'text-gray-600')}
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
