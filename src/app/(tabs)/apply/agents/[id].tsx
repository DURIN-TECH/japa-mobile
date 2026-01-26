import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View, Image, Text } from 'react-native';
import { Star, Clock, Globe, Award } from 'lucide-react-native';
import { verificationAgents } from '@/mock_data/agents';
import { VisaServiceCard } from '@/components/agents/VisaServiceCard';
import { ConsultationCard } from '@/components/agents/ConsultationCard';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, StatsCard } from '@/components/ui/themed';

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agent = verificationAgents.find((a) => a.id === id);
  const { isDark, colors } = useTheme();

  if (!agent) {
    return (
      <Screen>
        <Header title="Agent" showBack />
        <View className="flex-1 items-center justify-center">
          <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Agent not found
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Agent Profile" showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Agent Header */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <View className="mb-4 flex-row items-center">
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${agent.name}` }}
              className="mr-4 h-20 w-20 rounded-full"
            />
            <View className="flex-1">
              <Text
                className={cn(
                  'text-2xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                {agent.name}
              </Text>
              <View className="mt-1 flex-row items-center">
                <Star size={16} color="#facc15" />
                <Text
                  className={cn(
                    'ml-1',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                >
                  {agent.rating} ({agent.verificationCount} reviews)
                </Text>
              </View>
            </View>
          </View>

          <Text
            className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}
          >
            {agent.description}
          </Text>

          {/* Stats */}
          <StatsCard
            items={[
              {
                icon: <Award size={24} color={colors.primary} />,
                value: `${agent.successRate}%`,
                label: 'Success Rate',
              },
              {
                icon: <Clock size={24} color={colors.primary} />,
                value: agent.responseTime,
                label: 'Response Time',
              },
              {
                icon: <Globe size={24} color={colors.primary} />,
                value: agent.languages.length,
                label: 'Languages',
              },
            ]}
          />
        </View>

        {/* Consultation Section */}
        <Section title="Book a Consultation">
          <ConsultationCard price={agent.consultationFee} agentId={agent.id} />
        </Section>

        {/* Visa Services */}
        <Section title="Visa Services">
          {agent.featuredVisas.map((visa) => (
            <VisaServiceCard key={visa} visaType={visa} agentId={agent.id} />
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}
