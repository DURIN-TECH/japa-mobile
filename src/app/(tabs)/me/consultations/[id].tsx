import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View, TouchableOpacity, Text } from 'react-native';
import { Calendar, Video, MessageSquare } from 'lucide-react-native';
import { format } from 'date-fns';
import { useConsultations } from '@/hooks/useConsultations';

export default function ConsultationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { consultations } = useConsultations();
  const consultation = consultations.find((c) => c.id === id);

  if (!consultation) return null;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Consultation Info */}
      <View className="px-4 py-4">
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <View className="mb-4 flex-row items-center">
            <Calendar size={20} color="#2563eb" />
            <View className="ml-2">
              <Text className="font-semibold">
                {format(new Date(consultation.date), 'EEEE, MMMM d, yyyy')}
              </Text>
              <Text className="text-gray-600">{consultation.time}</Text>
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
        <Text className="mb-3 text-xl font-bold">Agent</Text>
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-semibold">
                {consultation.agentName}
              </Text>
              <Text className="text-gray-600">Visa Consultant</Text>
            </View>
            <TouchableOpacity className="rounded-full bg-blue-50 p-2">
              <MessageSquare size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Actions */}
      {consultation.status === 'upcoming' && (
        <View className="px-4 py-4">
          <TouchableOpacity className="rounded-xl bg-blue-600 p-4">
            <Text className="text-center font-semibold text-white">
              Join Meeting
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
            <Text className="text-center font-semibold text-gray-900">
              Reschedule
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="mt-3">
            <Text className="text-center font-semibold text-red-600">
              Cancel Consultation
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary (for completed consultations) */}
      {consultation.status === 'completed' && consultation.summary && (
        <View className="px-4 py-4">
          <Text className="mb-3 text-xl font-bold">Summary</Text>
          <View className="rounded-xl border border-gray-200 bg-white p-4">
            <Text className="text-gray-600">{consultation.summary}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
