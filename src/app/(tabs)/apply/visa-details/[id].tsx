import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Image, ActivityIndicator, Alert } from 'react-native';
import { Users, ChevronRight, FileText, Calendar } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';

import { useVisaType } from '@/hooks/useVisaTypes';
import { useCreateApplication } from '@/hooks/useApplications';
import { getCountryFlag } from '@/utils/countryFlags';
import { VisaRequirement } from '@/types/visas.type';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card } from '@/components/ui/themed';

export default function VisaDetailsScreen() {
  const { id, countryCode } = useLocalSearchParams<{ id: string; countryCode: string }>();
  const { data, isLoading, error } = useVisaType(countryCode, id);
  const { isDark, colors } = useTheme();
  const createApplication = useCreateApplication();
  const [isCreating, setIsCreating] = useState(false);

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <View className={cn('px-6 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <Header title="" showBack />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className={cn('text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Visa details not found
          </Text>
        </View>
      </Screen>
    );
  }

  const { visaType: visa, requirements } = data;

  const handleModeSelection = async (mode: 'self' | 'agent') => {
    if (mode === 'agent') {
      router.push('/apply/agents');
      return;
    }

    // Create a new self-service application
    setIsCreating(true);
    try {
      const application = await createApplication.mutateAsync({
        visaTypeId: visa.id,
        countryCode: visa.countryCode,
        mode: 'self',
      });

      if (application) {
        router.push({
          pathname: '/apply/self-service/[id]' as const,
          params: { id: application.id },
        });
      }
    } catch (err) {
      Alert.alert(
        'Error',
        'Failed to create application. Please try again.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className={cn('px-6 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <Header title="" showBack />
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text
                className={cn(
                  'text-3xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                {visa.name}
              </Text>
              <Text
                className={cn(
                  'mt-2 text-base',
                  isDark ? 'text-gray-400' : 'text-gray-600',
                )}
              >
                {visa.description}
              </Text>
            </View>
            <Image
              source={{ uri: getCountryFlag(visa.countryCode) }}
              className="h-12 w-12 rounded-full shadow-sm"
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Requirements Section */}
        {requirements && requirements.length > 0 && (
          <Section title="Requirements">
            <Card>
              {requirements.map((req: VisaRequirement, index: number) => (
                <View key={req.id} className={index < requirements.length - 1 ? 'mb-6' : ''}>
                  <Text
                    className={cn(
                      'text-lg font-semibold',
                      isDark ? 'text-white' : 'text-gray-900',
                    )}
                  >
                    {req.title}
                  </Text>
                  <Text
                    className={cn(
                      'mt-2 text-base leading-relaxed',
                      isDark ? 'text-gray-400' : 'text-gray-600',
                    )}
                  >
                    {req.description}
                  </Text>
                  <View className="mt-3 flex-row items-center">
                    <Calendar size={18} color={colors.primary} />
                    <Text className="ml-2 text-base text-blue-600">
                      Est. {req.estimatedTime}
                    </Text>
                  </View>
                  {req.requiredDocuments && req.requiredDocuments.length > 0 && (
                    <View
                      className={cn(
                        'mt-4 rounded-xl p-4',
                        isDark ? 'bg-blue-900/30' : 'bg-blue-50',
                      )}
                    >
                      <Text
                        className={cn(
                          'mb-2 text-base font-semibold',
                          isDark ? 'text-blue-300' : 'text-blue-900',
                        )}
                      >
                        Required Documents:
                      </Text>
                      {req.requiredDocuments.map((doc) => (
                        <Text
                          key={doc.id}
                          className={cn(
                            'mb-1 text-base',
                            isDark ? 'text-blue-200' : 'text-blue-800',
                          )}
                        >
                          - {doc.name}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* Eligibility Section */}
        {visa.eligibilityCriteria && visa.eligibilityCriteria.length > 0 && (
          <Section title="Eligibility Criteria">
            <Card>
              {visa.eligibilityCriteria.map((criteria, index) => (
                <View key={index} className={cn('flex-row', index < visa.eligibilityCriteria.length - 1 ? 'mb-3' : '')}>
                  <Text className={cn('mr-2', isDark ? 'text-blue-400' : 'text-blue-600')}>•</Text>
                  <Text
                    className={cn(
                      'flex-1 text-base',
                      isDark ? 'text-gray-300' : 'text-gray-700',
                    )}
                  >
                    {criteria}
                  </Text>
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* Application Options */}
        <Section title="Choose Your Path">
          <Card className="mb-4" onPress={() => handleModeSelection('agent')}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text
                  className={cn(
                    'text-lg font-semibold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  Use an Agent
                </Text>
                <Text
                  className={cn(
                    'mt-1 text-base',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                >
                  Get expert guidance throughout the process
                </Text>
                <View className="mt-3 flex-row items-center">
                  <Users size={18} color={colors.primary} />
                  <Text className="ml-2 text-base text-blue-600">
                    {visa.agentIds?.length || 0} Available Agents
                  </Text>
                </View>
              </View>
              <ChevronRight size={24} color={colors.primary} />
            </View>
          </Card>

          <Card onPress={() => !isCreating && handleModeSelection('self')}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text
                  className={cn(
                    'text-lg font-semibold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  Self Service
                </Text>
                <Text
                  className={cn(
                    'mt-1 text-base',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                >
                  Manage your own application
                </Text>
                <View className="mt-3 flex-row items-center">
                  <FileText size={18} color={colors.primary} />
                  <Text className="ml-2 text-base text-blue-600">
                    Step by step guidance
                  </Text>
                </View>
              </View>
              {isCreating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <ChevronRight size={24} color={colors.primary} />
              )}
            </View>
          </Card>
        </Section>

        {/* Price Info */}
        <Section>
          <LinearGradient
            colors={isDark ? ['#1e40af', '#1e3a8a'] : ['#3b82f6', '#2563eb']}
            style={{
              borderRadius: 16,
              padding: 16,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-medium text-white">
                Processing Time
              </Text>
              <Text className="text-lg font-semibold text-white">
                {visa.processingTime}
              </Text>
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-lg font-medium text-white">
                Validity
              </Text>
              <Text className="text-lg font-semibold text-white">
                {visa.validityPeriod}
              </Text>
            </View>
            <View className="mt-4 border-t border-white/20 pt-4">
              <Text className="text-base text-white/80">
                Starting from
              </Text>
              <Text className="mt-1 text-3xl font-bold text-white">
                ${visa.baseCostUsd}
              </Text>
            </View>
          </LinearGradient>
        </Section>
      </ScrollView>
    </Screen>
  );
}
