/**
 * Agent Detail Screen
 *
 * Shows a single agent's profile: name, rating, bio, stats, consultation
 * booking card, and visa services offered.
 *
 * INTEGRATION CHANGE: Previously looked up the agent from the mock
 * `verificationAgents` array by ID. Now fetches the real agent from
 * GET /agents/:id via the `useAgent` hook.
 *
 * The `formatAgentForDisplay()` helper converts API fields to the legacy
 * display format used by VisaServiceCard and ConsultationCard components.
 *
 * Backend endpoint: GET /agents/:id
 * Hook: useAgent(id) from @/hooks/useAgents
 */

import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View, Image, Text, ActivityIndicator } from 'react-native';
import { Star, Clock, Globe, Award } from 'lucide-react-native';
import { useAgent, formatAgentForDisplay } from '@/hooks/useAgents';
import { VisaServiceCard } from '@/components/agents/VisaServiceCard';
import { ConsultationCard } from '@/components/agents/ConsultationCard';
import { FeatureGate } from '@/components/auth/FeatureGate';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, StatsCard } from '@/components/ui/themed';
import { analyticsService } from '@/services/analytics.service';

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDark, colors } = useTheme();

  // Fetch agent data from backend API (replaces mock array lookup)
  const { data: apiAgent, isLoading, error } = useAgent(id);

  // Track agent profile view for analytics
  if (id) {
    analyticsService.trackAgentViewed(id);
  }

  // Loading state — show spinner while fetching from API
  if (isLoading) {
    return (
      <Screen>
        <Header title="Agent Profile" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // Error or not found state
  if (!apiAgent || error) {
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

  // Convert API agent to the display format used by child components
  const agent = formatAgentForDisplay(apiAgent);

  return (
    <Screen>
      <Header title="Agent Profile" showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Agent Header — avatar, name, rating */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <View className="mb-4 flex-row items-center">
            {/* Avatar using ui-avatars.com service (generates from name) */}
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
                  {/* verificationCount maps to totalReviews from the API */}
                  {agent.rating} ({agent.verificationCount} reviews)
                </Text>
              </View>
            </View>
          </View>

          {/* Agent bio/description */}
          <Text
            className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}
          >
            {agent.description}
          </Text>

          {/* Stats cards — success rate, response time, languages */}
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

        {/* Consultation booking card — price comes from API consultationFee.
            Gated by the "consultations.book" entitlement (paywall when locked;
            ungated until plans are seeded, so no premature lock). */}
        <Section title="Book a Consultation">
          <FeatureGate feature="consultations.book">
            <ConsultationCard
              price={agent.consultationFee}
              agentId={agent.id}
            />
          </FeatureGate>
        </Section>

        {/* Visa Services — lists the agent's featured visa types */}
        <Section title="Visa Services">
          {agent.featuredVisas.length > 0
            ? agent.featuredVisas.map((visa: string) => (
                <VisaServiceCard
                  key={visa}
                  visaType={visa}
                  agentId={agent.id}
                />
              ))
            : // Show specializations if no specific featured visas are set
              agent.specializations.map((spec: string) => (
                <VisaServiceCard
                  key={spec}
                  visaType={spec}
                  agentId={agent.id}
                />
              ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}
