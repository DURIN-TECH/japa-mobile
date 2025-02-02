import { View, Image, Text } from 'react-native';
import { Star, Clock, CheckCircle2, Globe } from 'lucide-react-native';
import { Agent } from '@/types/documents';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <View className="bg-white p-4 rounded-xl border border-gray-200 mb-3">

      {/* Agent Header */}
      <View className="flex-row items-center mb-3">
        <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center">
          <Text className="text-lg font-semibold text-gray-600">
            {agent.initials}
          </Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-semibold">{agent.name}</Text>
          <View className="flex-row items-center">
            <Star size={16} color="#facc15" />
            <Text className="ml-1 text-gray-600">
              {agent.rating} ({agent.verificationCount} reviews)
            </Text>
          </View>
        </View>
      </View>

      <Text className="text-gray-600 mb-4">{agent.description}</Text>

      <View className="flex-row flex-wrap gap-2 mb-3">
        {agent.specializations.map((spec) => (
          <View key={spec} className="bg-blue-50 px-3 py-1 rounded-full">
            <Text className="text-blue-600 text-sm">{spec}</Text>
          </View>
        ))}
      </View>
      
      {/* Stats */}
      <View className="flex-row justify-between bg-blue-50 p-3 rounded-lg mb-4">
        <View className="items-center">
          <CheckCircle2 size={20} color="#2563eb" />
          <Text className="text-blue-900 font-bold mt-1">{agent.successRate}%</Text>
          <Text className="text-blue-900 text-xs">Success Rate</Text>
        </View>
        <View className="items-center">
          <Clock size={20} color="#2563eb" />
          <Text className="text-blue-900 font-bold mt-1">{agent.responseTime}</Text>
          <Text className="text-blue-900 text-xs">Response Time</Text>
        </View>
        <View className="items-center">
          <Globe size={20} color="#2563eb" />
          <Text className="text-blue-900 font-bold mt-1">{agent.languages.length}</Text>
          <Text className="text-blue-900 text-xs">Languages</Text>
        </View>
      </View>

      {/* Price */}
      <View className="flex-row justify-between items-center">
        <Text className="text-gray-600">Consultation Fee</Text>
        <Text className="text-xl font-bold text-green-600">${agent.price}</Text>
      </View>
    </View>
  );
} 