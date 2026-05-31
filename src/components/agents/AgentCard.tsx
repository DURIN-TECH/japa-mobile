import { View, Text } from 'react-native';
import { Star, Clock, CheckCircle2, Globe } from 'lucide-react-native';
import { Agent } from '@/types/documents.type';
import { useTheme, cn } from '@/hooks/useTheme';
import { Card, StatsCard, Badge } from '@/components/ui/themed';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: Readonly<AgentCardProps>) {
  const { isDark, colors } = useTheme();

  return (
    <Card className="mb-3">
      {/* Agent Header */}
      <View className="mb-3 flex-row items-center">
        <View
          className={cn(
            'h-12 w-12 items-center justify-center rounded-full',
            isDark ? 'bg-gray-700' : 'bg-gray-100',
          )}
        >
          <Text
            className={cn(
              'text-lg font-semibold',
              isDark ? 'text-gray-300' : 'text-gray-600',
            )}
          >
            {agent.initials}
          </Text>
        </View>
        <View className="ml-3 flex-1">
          <Text
            className={cn(
              'text-lg font-semibold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {agent.name}
          </Text>
          <View className="flex-row items-center">
            <Star size={16} color="#facc15" />
            <Text
              className={cn('ml-1', isDark ? 'text-gray-400' : 'text-gray-600')}
            >
              {agent.rating} ({agent.verificationCount} reviews)
            </Text>
          </View>
        </View>
      </View>

      <Text className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
        {agent.description}
      </Text>

      <View className="mb-3 flex-row flex-wrap gap-2">
        {agent.specializations.map((spec) => (
          <Badge key={spec} variant="info">
            {spec}
          </Badge>
        ))}
      </View>

      {/* Stats */}
      <StatsCard
        items={[
          {
            icon: <CheckCircle2 size={20} color={colors.primary} />,
            value: `${agent.successRate}%`,
            label: 'Success Rate',
          },
          {
            icon: <Clock size={20} color={colors.primary} />,
            value: agent.responseTime,
            label: 'Response Time',
          },
          {
            icon: <Globe size={20} color={colors.primary} />,
            value: agent.languages.length,
            label: 'Languages',
          },
        ]}
      />

      {/* Price */}
      <View className="mt-4 flex-row items-center justify-between">
        <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          Consultation Fee
        </Text>
        <Text className="text-xl font-bold text-green-600">${agent.price}</Text>
      </View>
    </Card>
  );
}
