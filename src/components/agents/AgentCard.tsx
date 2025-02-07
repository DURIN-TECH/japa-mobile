import { View, Text } from 'react-native';
import { Star, Clock, CheckCircle2, Globe } from 'lucide-react-native';
import { Agent } from '@/types/documents';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: Readonly<AgentCardProps>) {
  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      {/* Agent Header */}
      <View className="mb-3 flex-row items-center">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-gray-100">
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

      <Text className="mb-4 text-gray-600">{agent.description}</Text>

      <View className="mb-3 flex-row flex-wrap gap-2">
        {agent.specializations.map((spec) => (
          <View key={spec} className="rounded-full bg-blue-50 px-3 py-1">
            <Text className="text-sm text-blue-600">{spec}</Text>
          </View>
        ))}
      </View>

      {/* Stats */}
      <View className="mb-4 flex-row justify-between rounded-lg bg-blue-50 p-3">
        <View className="items-center">
          <CheckCircle2 size={20} color="#2563eb" />
          <Text className="mt-1 font-bold text-blue-900">
            {agent.successRate}%
          </Text>
          <Text className="text-xs text-blue-900">Success Rate</Text>
        </View>
        <View className="items-center">
          <Clock size={20} color="#2563eb" />
          <Text className="mt-1 font-bold text-blue-900">
            {agent.responseTime}
          </Text>
          <Text className="text-xs text-blue-900">Response Time</Text>
        </View>
        <View className="items-center">
          <Globe size={20} color="#2563eb" />
          <Text className="mt-1 font-bold text-blue-900">
            {agent.languages.length}
          </Text>
          <Text className="text-xs text-blue-900">Languages</Text>
        </View>
      </View>

      {/* Price */}
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-600">Consultation Fee</Text>
        <Text className="text-xl font-bold text-green-600">${agent.price}</Text>
      </View>
    </View>
  );
}
