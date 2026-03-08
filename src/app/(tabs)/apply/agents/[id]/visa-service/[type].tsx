/**
 * Visa Service Detail Screen
 *
 * Shows details about a specific visa type that an agent can help with,
 * including requirements, statistics, and action buttons.
 *
 * INTEGRATION CHANGE: Replaced mock `verificationAgents` lookup
 * with `useAgent()` hook for agent name and fee display.
 *
 * Backend endpoint: GET /agents/:id
 */

import { useLocalSearchParams, router } from 'expo-router';
import { View, ScrollView, Text, ActivityIndicator } from 'react-native';
import {
  FileText,
  Clock,
  CheckCircle2,
  Award,
  Users,
  TrendingUp,
} from 'lucide-react-native';
// REPLACED: was `import { verificationAgents } from '@/mock_data/agents';`
import { useAgent, formatAgentForDisplay } from '@/hooks/useAgents';
import { useTheme, cn } from '@/hooks/useTheme';
import {
  Screen,
  Header,
  Section,
  Card,
  StatsCard,
  Button,
} from '@/components/ui/themed';

interface VisaStatistics {
  successRate: number;
  totalApplications: number;
  averageProcessingTime: string;
  commonRejectionReasons: string[];
}

interface VisaInfo {
  title: string;
  description: string;
  requirements: string[];
  processingTime: string;
  validity: string;
  statistics: VisaStatistics;
}

const VISA_DETAILS: Record<string, VisaInfo> = {
  H1B: {
    title: 'H-1B Work Visa',
    description: 'For foreign workers in specialty occupations',
    requirements: [
      "Bachelor's degree or higher",
      'Job offer from US employer',
      'Specialty occupation position',
      'Prevailing wage requirement',
    ],
    processingTime: '6-8 months',
    validity: '3 years (extendable to 6 years)',
    statistics: {
      successRate: 92,
      totalApplications: 1234,
      averageProcessingTime: '5.5 months',
      commonRejectionReasons: [
        'Insufficient documentation',
        'Specialty occupation criteria not met',
        'Prevailing wage issues',
      ],
    },
  },
  F1: {
    title: 'F-1 Student Visa',
    description: 'For international students studying in the US',
    requirements: [
      'Acceptance to US school',
      'Proof of financial support',
      'Strong ties to home country',
      'English proficiency',
    ],
    processingTime: '2-3 months',
    validity: 'Duration of study program',
    statistics: {
      successRate: 85,
      totalApplications: 567,
      averageProcessingTime: '2.5 months',
      commonRejectionReasons: [
        'Insufficient financial support',
        'Lack of ties to home country',
        'Ineligibility for chosen program',
      ],
    },
  },
  'B1/B2': {
    title: 'B-1/B-2 Tourist Visa',
    description: 'For tourism, business, and medical treatment',
    requirements: [
      'Proof of ties to home country',
      'Financial ability to support trip',
      'No intent to immigrate',
      'Return ticket',
    ],
    processingTime: '1-2 months',
    validity: '6 months (extendable to 1 year)',
    statistics: {
      successRate: 95,
      totalApplications: 987,
      averageProcessingTime: '1.5 months',
      commonRejectionReasons: [
        'Lack of ties to home country',
        'Insufficient funds',
      ],
    },
  },
  E2: {
    title: 'E-2 Investor Visa',
    description: 'For investors from treaty countries',
    requirements: [
      'Investment in US business',
      'Substantial investment',
      'Control of funds',
      'Business plan',
    ],
    processingTime: '3-5 months',
    validity: '2 years (extendable)',
    statistics: {
      successRate: 88,
      totalApplications: 345,
      averageProcessingTime: '4 months',
      commonRejectionReasons: [
        'Insufficient investment',
        'Business plan not viable',
        'Control of funds not proven',
      ],
    },
  },
  'EB-5': {
    title: 'EB-5 Investor Visa',
    description: 'For foreign investors creating jobs in the US',
    requirements: [
      'Investment of $900,000 or $1.8M',
      'Create 10 full-time jobs',
      'At-risk investment',
      'No criminal record',
    ],
    processingTime: '24-30 months',
    validity: '2 years (conditional)',
    statistics: {
      successRate: 80,
      totalApplications: 123,
      averageProcessingTime: '27 months',
      commonRejectionReasons: [
        'Insufficient investment',
        'Job creation not met',
        'Criminal record',
      ],
    },
  },
  L1: {
    title: 'L-1 Intracompany Transfer Visa',
    description: 'For employees of multinational companies',
    requirements: [
      'Employed at foreign company',
      'Transfer to US branch',
      'Specialized knowledge',
      'Managerial or executive role',
    ],
    processingTime: '3-6 months',
    validity: '1-3 years',
    statistics: {
      successRate: 90,
      totalApplications: 456,
      averageProcessingTime: '4.5 months',
      commonRejectionReasons: [
        'Lack of specialized knowledge',
        'Role not managerial/executive',
        'Company not multinational',
      ],
    },
  },
} as const;

type VisaType = keyof typeof VISA_DETAILS;

export default function VisaServiceScreen() {
  const { id, type } = useLocalSearchParams<{
    id: string;
    type: VisaType;
  }>();
  const { isDark, colors } = useTheme();

  // Fetch agent from API instead of mock array
  const { data: apiAgent, isLoading } = useAgent(id);

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!apiAgent) return null;

  const agent = formatAgentForDisplay(apiAgent);

  const visaInfo = VISA_DETAILS[type];
  if (!visaInfo) return null;

  return (
    <Screen>
      <Header title={visaInfo.title} showBack />
      <ScrollView className="flex-1">
        {/* Header Info */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <Text
            className={cn('mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}
          >
            {visaInfo.description}
          </Text>

          <Card variant="highlight" className="mt-4">
            <View className="mb-2 flex-row items-center">
              <Clock size={20} color={colors.primary} />
              <Text
                className={cn(
                  'ml-2',
                  isDark ? 'text-blue-300' : 'text-blue-900',
                )}
              >
                Processing Time: {visaInfo.processingTime}
              </Text>
            </View>
            <View className="flex-row items-center">
              <FileText size={20} color={colors.primary} />
              <Text
                className={cn(
                  'ml-2',
                  isDark ? 'text-blue-300' : 'text-blue-900',
                )}
              >
                Validity: {visaInfo.validity}
              </Text>
            </View>
          </Card>
        </View>

        {/* Success Rate Statistics */}
        <Section title="Success Statistics">
          <Card>
            <StatsCard
              items={[
                {
                  icon: <Award size={24} color={colors.primary} />,
                  value: `${visaInfo.statistics.successRate}%`,
                  label: 'Success Rate',
                },
                {
                  icon: <Users size={24} color={colors.primary} />,
                  value: visaInfo.statistics.totalApplications.toLocaleString(),
                  label: 'Applications',
                },
                {
                  icon: <TrendingUp size={24} color={colors.primary} />,
                  value: visaInfo.statistics.averageProcessingTime,
                  label: 'Avg. Time',
                },
              ]}
            />

            {/* Common Rejection Reasons */}
            <View
              className={cn(
                'mt-4 border-t pt-4',
                isDark ? 'border-gray-700' : 'border-gray-100',
              )}
            >
              <Text
                className={cn(
                  'mb-2 font-semibold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                Common Rejection Reasons:
              </Text>
              {visaInfo.statistics.commonRejectionReasons.map(
                (reason, index) => (
                  <View key={index} className="mb-2 flex-row items-center">
                    <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                    <Text
                      className={isDark ? 'text-gray-400' : 'text-gray-600'}
                    >
                      {reason}
                    </Text>
                  </View>
                ),
              )}
            </View>
          </Card>
        </Section>

        {/* Requirements */}
        <Section title="Requirements">
          <Card>
            {visaInfo.requirements.map((req, index) => (
              <View
                key={index}
                className="mb-3 flex-row items-center last:mb-0"
              >
                <CheckCircle2 size={20} color={colors.primary} />
                <Text
                  className={cn(
                    'ml-2',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {req}
                </Text>
              </View>
            ))}
          </Card>
        </Section>

        {/* Agent Support */}
        <Section title="Agent Support">
          <Card>
            <Text className={isDark ? 'text-white' : 'text-gray-900'}>
              {agent.name} will assist you with:
            </Text>
            <View className="mt-2 space-y-2">
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                - Document preparation and review
              </Text>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                - Application filing assistance
              </Text>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                - Interview preparation
              </Text>
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                - Case status monitoring
              </Text>
            </View>
          </Card>
        </Section>

        {/* Action Buttons */}
        <Section>
          <Button
            className="mb-3"
            onPress={() => {
              router.push({
                pathname: `/apply/agents/[id]/payment` as const,
                params: {
                  id,
                  type: 'visa',
                  date: new Date().toISOString(),
                  time: 'N/A',
                },
              });
            }}
          >
            Start Application (${agent.price})
          </Button>

          <Button
            variant="outline"
            onPress={() => {
              router.push({
                pathname: `/apply/agents/[id]/book-consultation` as const,
                params: { id },
              });
            }}
          >
            Book Consultation First
          </Button>
        </Section>
      </ScrollView>
    </Screen>
  );
}
