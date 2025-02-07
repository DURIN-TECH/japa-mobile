import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import {
  Clock,
  ChevronLeft,
  Calendar as CalendarIcon,
} from 'lucide-react-native';
import { verificationAgents } from '@/mock_data/agents';
import { TimeSlotPicker } from '@/components/consultation/TimeSlotPicker';
import { DatePicker } from '@/components/consultation/DatePicker';

export default function BookConsultation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const agent = verificationAgents.find((a) => a.id === id);
  if (!agent) return null;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-4 py-4">
        <TouchableOpacity
          className="mb-4 flex-row items-center"
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#374151" />
          <Text className="ml-1 text-gray-600">Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold">Book Consultation, will</Text>
        <Text className="mt-1 text-gray-600">
          Schedule a consultation with {agent.name}
        </Text>
      </View>

      {/* Consultation Info */}
      <View className="bg-white px-4 py-4">
        <View className="rounded-xl bg-blue-50 p-4">
          <View className="mb-2 flex-row items-center">
            <Clock size={20} color="#2563eb" />
            <Text className="ml-2 text-blue-900">30 Minutes</Text>
          </View>
          <View className="flex-row items-center">
            <CalendarIcon size={20} color="#2563eb" />
            <Text className="ml-2 text-blue-900">
              Available within {agent.responseTime}
            </Text>
          </View>
        </View>
      </View>

      {/* Date Selection */}
      <View className="px-4 py-4">
        <Text className="mb-3 text-xl font-bold">Select Date</Text>
        <DatePicker
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </View>

      {/* Time Slots */}
      <View className="px-4 py-4">
        <Text className="mb-3 text-xl font-bold">Select Time</Text>
        <TimeSlotPicker
          selectedTime={selectedTime}
          onSelectTime={setSelectedTime}
        />
      </View>

      {/* Continue Button */}
      <View className="px-4 py-4">
        <TouchableOpacity
          className={`rounded-xl p-4 ${
            selectedTime ? 'bg-blue-600' : 'bg-gray-300'
          } `}
          disabled={!selectedTime}
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
          <Text className="text-center font-bold text-white">
            Continue to Payment
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
