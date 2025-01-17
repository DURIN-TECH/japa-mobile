import { View, Image } from 'react-native';
import { Star, Clock } from 'lucide-react-native';
import { ThemedText } from '@/components/ThemedText';
import { Agent } from '@/types/documents';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <View className="bg-white p-4 rounded-xl border border-gray-200 mb-3">
      <View className="flex-row items-center mb-3">
        <Image
          source={{ uri: `https://ui-avatars.com/api/?name=${agent.name}` }}
          className="w-12 h-12 rounded-full mr-3"
        />
        <View className="flex-1">
          <ThemedText className="font-semibold text-lg">{agent.name}</ThemedText>
          <View className="flex-row items-center">
            <Star size={16} color="#facc15" />
            <ThemedText className="ml-1 text-gray-600">
              {agent.rating} ({agent.verificationCount} reviews)
            </ThemedText>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-3">
        {agent.specializations.map((spec) => (
          <View key={spec} className="bg-blue-50 px-3 py-1 rounded-full">
            <ThemedText className="text-blue-600 text-sm">{spec}</ThemedText>
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between border-t border-gray-100 pt-3">
        <View className="flex-row items-center">
          <Clock size={16} color="#6b7280" />
          <ThemedText className="ml-1 text-gray-600">{agent.responseTime}</ThemedText>
        </View>
        <ThemedText className="font-bold text-green-600">
          From ${agent.price}
        </ThemedText>
      </View>
    </View>
  );
} 