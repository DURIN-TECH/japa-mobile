import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { Clock, Calendar as CalendarIcon } from 'lucide-react-native';
import { verificationAgents } from '@/mock_data/agents';
import { TimeSlotPicker } from '@/components/consultation/TimeSlotPicker';
import { DatePicker } from '@/components/consultation/DatePicker';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button } from '@/components/ui/themed';

export default function BookConsultation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const { isDark, colors } = useTheme();

  const agent = verificationAgents.find((a) => a.id === id);
  if (!agent) return null;

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
          <Text className={cn('mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Schedule a consultation with {agent.name}
          </Text>
        </View>

        {/* Consultation Info */}
        <Section>
          <Card variant="highlight">
            <View className="mb-2 flex-row items-center">
              <Clock size={20} color={colors.primary} />
              <Text
                className={cn('ml-2', isDark ? 'text-blue-300' : 'text-blue-900')}
              >
                30 Minutes
              </Text>
            </View>
            <View className="flex-row items-center">
              <CalendarIcon size={20} color={colors.primary} />
              <Text
                className={cn('ml-2', isDark ? 'text-blue-300' : 'text-blue-900')}
              >
                Available within {agent.responseTime}
              </Text>
            </View>
          </Card>
        </Section>

        {/* Date Selection */}
        <Section title="Select Date">
          <DatePicker selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </Section>

        {/* Time Slots */}
        <Section title="Select Time">
          <TimeSlotPicker
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
          />
        </Section>

        {/* Continue Button */}
        <Section>
          <Button
            disabled={!selectedTime}
            className={!selectedTime ? 'opacity-50' : ''}
            onPress={() => {
              router.replace({
                pathname: '/apply/agents/[id]/payment',
                params: {
                  id,
                  type: 'consultation',
                  date: selectedDate.toISOString(),
                  time: selectedTime as string,
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
