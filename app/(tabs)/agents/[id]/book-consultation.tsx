import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Calendar, Clock, ChevronLeft, Calendar as CalendarIcon } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { verificationAgents } from "@/constants/data/agents";
import { TimeSlotPicker } from "@/components/consultation/TimeSlotPicker";
import { DatePicker } from "@/components/consultation/DatePicker";

export default function BookConsultation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  const agent = verificationAgents.find(a => a.id === id);
  if (!agent) return null;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-4 border-b border-gray-200">
        <TouchableOpacity 
          className="flex-row items-center mb-4" 
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#374151" />
          <ThemedText className="text-gray-600 ml-1">Back</ThemedText>
        </TouchableOpacity>
        <ThemedText className="text-2xl font-bold">Book Consultation, will</ThemedText>
        <ThemedText className="text-gray-600 mt-1">
          Schedule a consultation with {agent.name}
        </ThemedText>
      </View>
      
      {/* Consultation Info */}
      <View className="bg-white px-4 py-4">
        <View className="bg-blue-50 rounded-xl p-4">
          <View className="flex-row items-center mb-2">
            <Clock size={20} color="#2563eb" />
            <ThemedText className="ml-2 text-blue-900">30 Minutes</ThemedText>
          </View>
          <View className="flex-row items-center">
            <CalendarIcon size={20} color="#2563eb" />
            <ThemedText className="ml-2 text-blue-900">
              Available within {agent.responseTime}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Date Selection */}
      <View className="px-4 py-4">
        <ThemedText className="text-xl font-bold mb-3">Select Date</ThemedText>
        <DatePicker 
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </View>

      {/* Time Slots */}
      <View className="px-4 py-4">
        <ThemedText className="text-xl font-bold mb-3">Select Time</ThemedText>
        <TimeSlotPicker
          selectedTime={selectedTime}
          onSelectTime={setSelectedTime}
          date={selectedDate}
        />
      </View>

      {/* Continue Button */}
      <View className="px-4 py-4">
        <TouchableOpacity 
          className={`
            p-4 rounded-xl
            ${selectedTime ? 'bg-blue-600' : 'bg-gray-300'}
          `}
          disabled={!selectedTime}
          onPress={() => {
            router.replace({
              pathname: "/agents/[id]/payment",
              params: {
                id,
                type: 'consultation',
                date: selectedDate.toISOString(),
                time: selectedTime as string,
              }
            });
          }}
        >
          <ThemedText className="text-white text-center font-bold">
            Continue to Payment
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
} 