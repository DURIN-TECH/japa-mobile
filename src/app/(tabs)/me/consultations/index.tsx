import { ScrollView, View, TouchableOpacity, Text } from 'react-native';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useConsultations } from '@/hooks/useConsultations';
import { ConsultationCard } from '@/components/consultations/ConsultationCard';
import { Consultation } from '@/types/consultations';

export default function ConsultationsScreen() {
  const { consultations } = useConsultations();

  const handleConsultationPress = (consultation: Consultation) => {
    router.push({
      pathname: '/me/consultations/[id]' as const,
      params: { id: consultation.id },
    });
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Status Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-2"
      >
        {[
          { label: 'Upcoming', icon: Clock },
          { label: 'Completed', icon: CheckCircle2 },
          { label: 'Cancelled', icon: AlertCircle },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.label}
            className="mr-2 flex-row items-center rounded-full border border-gray-200 bg-white px-4 py-2"
          >
            <filter.icon size={16} color="#6b7280" />
            <Text className="ml-2">{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Consultations List */}
      <View className="px-4 py-2">
        {consultations.map((consultation: Consultation) => (
          <TouchableOpacity
            key={consultation.id}
            onPress={() => handleConsultationPress(consultation)}
          >
            <ConsultationCard consultation={consultation} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
