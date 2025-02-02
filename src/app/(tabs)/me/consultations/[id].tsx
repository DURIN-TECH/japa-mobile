import { useLocalSearchParams } from "expo-router";
import { ScrollView, View, TouchableOpacity, Text } from "react-native";
import { Calendar, Clock, Video, MessageSquare } from "lucide-react-native";
import { useConsultations } from "@/hooks/useConsultations";
import { format } from "date-fns";

export default function ConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { consultations } = useConsultations();
  const consultation = consultations.find(c => c.id === id);

  if (!consultation) return null;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Consultation Info */}
      <View className="px-4 py-4">
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <View className="flex-row items-center mb-4">
            <Calendar size={20} color="#2563eb" />
            <View className="ml-2">
              <Text className="font-semibold">
                {format(new Date(consultation.date), 'EEEE, MMMM d, yyyy')}
              </Text>
              <Text className="text-gray-600">
                {consultation.time}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <Video size={20} color="#2563eb" />
            <Text className="ml-2 text-gray-600">
              30 Minutes Video Consultation
            </Text>
          </View>
        </View>
      </View>

      {/* Agent Info */}
      <View className="px-4 py-4">
        <Text className="text-xl font-bold mb-3">Agent</Text>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-semibold text-lg">
                {consultation.agentName}
              </Text>
              <Text className="text-gray-600">
                Visa Consultant
              </Text>
            </View>
            <TouchableOpacity 
              className="bg-blue-50 p-2 rounded-full"
            >
              <MessageSquare size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Actions */}
      {consultation.status === "upcoming" && (
        <View className="px-4 py-4">
          <TouchableOpacity className="bg-blue-600 p-4 rounded-xl">
            <Text className="text-white text-center font-semibold">
              Join Meeting
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3 bg-white p-4 rounded-xl border border-gray-200">
            <Text className="text-gray-900 text-center font-semibold">
              Reschedule
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3">
            <Text className="text-red-600 text-center font-semibold">
              Cancel Consultation
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary (for completed consultations) */}
      {consultation.status === "completed" && consultation.summary && (
        <View className="px-4 py-4">
          <Text className="text-xl font-bold mb-3">Summary</Text>
          <View className="bg-white p-4 rounded-xl border border-gray-200">
            <Text className="text-gray-600">
              {consultation.summary}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
} 