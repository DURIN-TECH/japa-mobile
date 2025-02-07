import { View, TouchableOpacity, Text } from 'react-native';
import { Calendar, Clock } from 'lucide-react-native';
import { Link } from 'expo-router';

interface ConsultationCardProps {
  price: number;
  agentId: string;
}

export function ConsultationCard({
  price,
  agentId,
}: Readonly<ConsultationCardProps>) {
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-4">
      <View className="mb-3 flex-row items-center">
        <Calendar size={20} color="#2563eb" />
        <Text className="ml-2 font-semibold">30-minute Video Consultation</Text>
      </View>

      <View className="mb-4 flex-row items-center">
        <Clock size={16} color="#6b7280" />
        <Text className="ml-2 text-gray-600">Available within 24 hours</Text>
      </View>

      <View className="flex-row items-center justify-between border-t border-gray-100 pt-3">
        <Text className="font-bold text-green-600">${price}</Text>
        <Link
          href={`/apply/agents/${agentId}/book-consultation?agentId=${agentId}`}
          asChild
        >
          <TouchableOpacity className="rounded-lg bg-blue-600 px-4 py-2">
            <Text className="font-semibold text-white">Book Now</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}
