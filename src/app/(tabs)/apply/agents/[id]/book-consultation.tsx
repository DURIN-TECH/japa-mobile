/**
 * Book Consultation Screen
 *
 * Step 1 of the consultation booking flow: select date and time.
 * User picks a date and available time slot, then proceeds to payment.
 *
 * INTEGRATION CHANGE: Replaced mock `verificationAgents` lookup with
 * real `useAgent()` hook that fetches from GET /agents/:id.
 * Agent's response time and availability slots come from real data.
 *
 * Backend endpoint: GET /agents/:id (for agent info)
 */

import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { View, ScrollView, Text, ActivityIndicator } from 'react-native';
import { Clock, Calendar as CalendarIcon } from 'lucide-react-native';
import { useAgent, formatAgentForDisplay } from '@/hooks/useAgents';
import { TimeSlotPicker } from '@/components/consultation/TimeSlotPicker';
import { DatePicker } from '@/components/consultation/DatePicker';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button } from '@/components/ui/themed';

export default function BookConsultation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const { isDark, colors } = useTheme();

  // Fetch agent from API instead of mock array
  const { data: apiAgent, isLoading } = useAgent(id);

  // Loading state while fetching agent
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

  // Convert to display format for showing agent name and response time
  const agent = formatAgentForDisplay(apiAgent);

  return (
    <Screen>
      <ScrollView className="flex-1">
        {/* Header */}
        <View
          className={cn(
            'border-b px-4 py-4',
            isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white',
          )}
        >
          <Header title="Book Consultation" showBack />
          <Text
            className={cn('mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}
          >
            Schedule a consultation with {agent.name}
          </Text>
        </View>

        {/* Consultation Info — shows duration and agent availability */}
        <Section>
          <Card variant="highlight">
            <View className="mb-2 flex-row items-center">
              <Clock size={20} color={colors.primary} />
              <Text
                className={cn(
                  'ml-2',
                  isDark ? 'text-blue-300' : 'text-blue-900',
                )}
              >
                30 Minutes
              </Text>
            </View>
            <View className="flex-row items-center">
              <CalendarIcon size={20} color={colors.primary} />
              <Text
                className={cn(
                  'ml-2',
                  isDark ? 'text-blue-300' : 'text-blue-900',
                )}
              >
                Available within {agent.responseTime}
              </Text>
            </View>
          </Card>
        </Section>

        {/* Date Selection */}
        <Section title="Select Date">
          <DatePicker
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </Section>

        {/* Time Slots */}
        <Section title="Select Time">
          <TimeSlotPicker
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
          />
        </Section>

        {/* Continue Button — passes agent fee to payment screen */}
        <Section>
          <Button
            disabled={!selectedTime}
            className={!selectedTime ? 'opacity-50' : ''}
            onPress={() => {
              router.replace({
                pathname: '/apply/agents/[id]/payment',
                params: {
                  id: id!,
                  type: 'consultation',
                  date: selectedDate.toISOString(),
                  time: selectedTime as string,
                  // Pass the consultation fee from the API agent data (in cents)
                  fee: String(apiAgent.consultationFee),
                },
              });
            }}
          >
            Continue to Payment
          </Button>
        </Section>
      </ScrollView>
    </Screen>
  );
}
