import { View, TouchableOpacity } from "react-native";
import { Calendar, Clock } from "lucide-react-native";
import { Link } from "expo-router";
import { ThemedText } from "@/components/ThemedText";

interface ConsultationCardProps {
  price: number;
  agentId: string;
}

export function ConsultationCard({ price, agentId }: Readonly<ConsultationCardProps>) {
  return (
    <View className="bg-white p-4 rounded-xl border border-gray-200">
      <View className="flex-row items-center mb-3">
        <Calendar size={20} color="#2563eb" />
        <ThemedText className="ml-2 font-semibold">30-minute Video Consultation</ThemedText>
      </View>

      <View className="flex-row items-center mb-4">
        <Clock size={16} color="#6b7280" />
        <ThemedText className="ml-2 text-gray-600">Available within 24 hours</ThemedText>
      </View>

      <View className="flex-row items-center justify-between border-t border-gray-100 pt-3">
        <ThemedText className="font-bold text-green-600">${price}</ThemedText>
        <Link 
          href={`/agents/${agentId}/book-consultation?agentId=${agentId}`}
          asChild
        >
          <TouchableOpacity className="bg-blue-600 px-4 py-2 rounded-lg">
            <ThemedText className="text-white font-semibold">Book Now</ThemedText>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
} 