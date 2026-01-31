import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Users,
  FileText,
  Plane,
  Info,
} from 'lucide-react-native';

import {
  useEligibilityCheck,
  getEligibilityLevelInfo,
  getSuggestedPathInfo,
  formatEligibilityScore,
} from '@/hooks/useEligibility';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button } from '@/components/ui/themed';
import { EligibilityBreakdownItem } from '@/types/eligibility.type';

export default function EligibilityResultScreen() {
  const { checkId } = useLocalSearchParams<{ checkId: string }>();
  const { data: check, isLoading, error } = useEligibilityCheck(checkId ?? '');
  const { isDark, colors } = useTheme();

  if (isLoading) {
    return (
      <Screen>
        <Header title="Results" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className={cn('mt-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Loading results...
          </Text>
        </View>
      </Screen>
    );
  }

  if (error || !check) {
    return (
      <Screen>
        <Header title="Results" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <XCircle size={48} color={isDark ? '#ef4444' : '#dc2626'} />
          <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Unable to load results. Please try again.
          </Text>
          <Button onPress={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </View>
      </Screen>
    );
  }

  const levelInfo = getEligibilityLevelInfo(check.eligibilityLevel);
  const pathInfo = getSuggestedPathInfo(check.suggestedPath);
  const scoreInfo = formatEligibilityScore(check.score);

  // Icons for suggested paths
  const PathIcon =
    pathInfo.icon === 'check'
      ? Plane
      : pathInfo.icon === 'self'
      ? FileText
      : pathInfo.icon === 'agent'
      ? Users
      : AlertTriangle;

  const handleContinue = () => {
    switch (check.suggestedPath) {
      case 'visa_free':
        // No action needed, go back to visa details
        router.back();
        break;
      case 'self_service':
        // Start self-service application
        router.push({
          pathname: '/apply/visa-details/[id]' as const,
          params: { id: check.visaTypeId, countryCode: check.countryCode },
        });
        break;
      case 'agent_assisted':
        // Go to agents
        router.push('/apply/agents');
        break;
      case 'not_eligible':
        // Go to agents for consultation
        router.push('/apply/agents');
        break;
    }
  };

  return (
    <Screen>
      <Header title="Results" showBack />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Card */}
        <Section>
          <Card
            className={cn(
              'items-center py-8',
              !check.visaRequired && 'bg-blue-500'
            )}
          >
            {!check.visaRequired ? (
              <>
                <Plane size={64} color="#fff" />
                <Text className="mt-4 text-2xl font-bold text-white">
                  No Visa Required!
                </Text>
                <Text className="mt-2 text-center text-white/80 px-4">
                  Based on your nationality, you can travel to this destination
                  without a visa.
                </Text>
              </>
            ) : (
              <>
                {/* Score Circle */}
                <View
                  className={cn(
                    'w-32 h-32 rounded-full items-center justify-center border-8',
                    check.eligibilityLevel === 'high'
                      ? 'border-green-500'
                      : check.eligibilityLevel === 'medium'
                      ? 'border-yellow-500'
                      : 'border-red-500'
                  )}
                >
                  <Text className={cn('text-4xl font-bold', scoreInfo.color)}>
                    {check.score}
                  </Text>
                  <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    / 100
                  </Text>
                </View>

                {/* Level Badge */}
                <View
                  className={cn(
                    'mt-4 px-4 py-2 rounded-full',
                    isDark ? levelInfo.darkBgColor : levelInfo.bgColor
                  )}
                >
                  <Text
                    className={cn(
                      'font-semibold',
                      isDark ? levelInfo.darkColor : levelInfo.color
                    )}
                  >
                    {levelInfo.label}
                  </Text>
                </View>

                <Text
                  className={cn(
                    'mt-3 text-center px-4',
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  )}
                >
                  {levelInfo.description}
                </Text>
              </>
            )}
          </Card>
        </Section>

        {/* Visa-Free Details */}
        {!check.visaRequired && check.exemptionDetails && (
          <Section title="Travel Conditions">
            <Card>
              {check.exemptionDetails.maxStayDays && (
                <View className="flex-row items-center mb-3">
                  <Info size={20} color={colors.primary} />
                  <Text
                    className={cn(
                      'ml-3 flex-1',
                      isDark ? 'text-gray-200' : 'text-gray-800'
                    )}
                  >
                    Maximum stay: {check.exemptionDetails.maxStayDays} days
                  </Text>
                </View>
              )}
              {check.exemptionDetails.conditions?.map((condition, index) => (
                <View key={index} className="flex-row items-start mb-2">
                  <Text className={cn('mr-2', isDark ? 'text-blue-400' : 'text-blue-600')}>
                    *
                  </Text>
                  <Text
                    className={cn(
                      'flex-1',
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    )}
                  >
                    {condition}
                  </Text>
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* Suggested Path */}
        {check.visaRequired && (
          <Section title="Recommended Path">
            <Card>
              <View className="flex-row items-center">
                <View
                  className={cn(
                    'w-12 h-12 rounded-full items-center justify-center',
                    pathInfo.color === 'green'
                      ? 'bg-green-100'
                      : pathInfo.color === 'blue'
                      ? 'bg-blue-100'
                      : pathInfo.color === 'yellow'
                      ? 'bg-yellow-100'
                      : 'bg-red-100'
                  )}
                >
                  <PathIcon
                    size={24}
                    color={
                      pathInfo.color === 'green'
                        ? '#16a34a'
                        : pathInfo.color === 'blue'
                        ? '#2563eb'
                        : pathInfo.color === 'yellow'
                        ? '#ca8a04'
                        : '#dc2626'
                    }
                  />
                </View>
                <View className="ml-4 flex-1">
                  <Text
                    className={cn(
                      'text-lg font-semibold',
                      isDark ? 'text-white' : 'text-gray-900'
                    )}
                  >
                    {pathInfo.label}
                  </Text>
                  <Text
                    className={cn(
                      'mt-1',
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    )}
                  >
                    {pathInfo.description}
                  </Text>
                </View>
              </View>
            </Card>
          </Section>
        )}

        {/* Recommendations */}
        {check.recommendations && check.recommendations.length > 0 && (
          <Section title={check.visaRequired ? 'Recommendations' : 'Next Steps'}>
            <Card>
              {check.recommendations.map((rec, index) => (
                <View
                  key={index}
                  className={cn(
                    'flex-row items-start',
                    index < check.recommendations.length - 1 && 'mb-3'
                  )}
                >
                  <View className="mt-1">
                    {index === 0 ? (
                      <Info size={16} color={colors.primary} />
                    ) : (
                      <Text className={cn('mr-2', isDark ? 'text-blue-400' : 'text-blue-600')}>
                        *
                      </Text>
                    )}
                  </View>
                  <Text
                    className={cn(
                      'ml-2 flex-1',
                      index === 0
                        ? isDark
                          ? 'text-gray-200 font-medium'
                          : 'text-gray-800 font-medium'
                        : isDark
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    )}
                  >
                    {rec}
                  </Text>
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* Detailed Breakdown */}
        {check.visaRequired && check.breakdown && check.breakdown.length > 0 && (
          <Section title="Detailed Breakdown">
            <Card>
              {check.breakdown.map((item, index) => (
                <BreakdownItem
                  key={item.questionId}
                  item={item}
                  isDark={isDark}
                  isLast={index === check.breakdown.length - 1}
                />
              ))}
            </Card>
          </Section>
        )}

        {/* Missing Requirements */}
        {check.missingRequirements && check.missingRequirements.length > 0 && (
          <Section title="Missing Information">
            <Card className={isDark ? 'border-yellow-500/50' : 'border-yellow-200'}>
              {check.missingRequirements.map((req, index) => (
                <View
                  key={index}
                  className={cn(
                    'flex-row items-center',
                    index < check.missingRequirements.length - 1 && 'mb-2'
                  )}
                >
                  <AlertTriangle size={16} color="#ca8a04" />
                  <Text
                    className={cn(
                      'ml-2 flex-1',
                      isDark ? 'text-yellow-200' : 'text-yellow-800'
                    )}
                  >
                    {req}
                  </Text>
                </View>
              ))}
            </Card>
          </Section>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View
        className={cn(
          'absolute bottom-0 left-0 right-0 px-6 py-4',
          isDark ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'
        )}
      >
        <Button onPress={handleContinue} className="w-full">
          <View className="flex-row items-center justify-center">
            <Text className="text-white font-semibold mr-2">
              {check.suggestedPath === 'visa_free'
                ? 'Back to Visa Details'
                : check.suggestedPath === 'self_service'
                ? 'Start Application'
                : 'Find an Agent'}
            </Text>
            <ChevronRight size={20} color="#fff" />
          </View>
        </Button>
      </View>
    </Screen>
  );
}

// ============================================
// BREAKDOWN ITEM COMPONENT
// ============================================

function BreakdownItem({
  item,
  isDark,
  isLast,
}: {
  item: EligibilityBreakdownItem;
  isDark: boolean;
  isLast: boolean;
}) {
  return (
    <View
      className={cn(
        'py-3',
        !isLast && `border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`
      )}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text
            className={cn(
              'font-medium',
              isDark ? 'text-gray-200' : 'text-gray-800'
            )}
          >
            {item.question}
          </Text>
          <Text
            className={cn(
              'mt-1 text-sm',
              isDark ? 'text-gray-400' : 'text-gray-600'
            )}
          >
            Your answer: {item.answer}
          </Text>
        </View>

        <View className="flex-row items-center">
          {item.passed ? (
            <CheckCircle2 size={20} color="#16a34a" />
          ) : (
            <XCircle size={20} color="#dc2626" />
          )}
          <Text
            className={cn(
              'ml-2 text-sm font-medium',
              item.passed ? 'text-green-600' : 'text-red-600'
            )}
          >
            {item.points}/{item.maxPoints}
          </Text>
        </View>
      </View>

      {item.recommendation && !item.passed && (
        <View
          className={cn(
            'mt-2 rounded-lg p-2',
            isDark ? 'bg-red-900/20' : 'bg-red-50'
          )}
        >
          <Text className={cn('text-sm', isDark ? 'text-red-200' : 'text-red-700')}>
            {item.recommendation}
          </Text>
        </View>
      )}
    </View>
  );
}
