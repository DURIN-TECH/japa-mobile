import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, TouchableOpacity, Text, Image } from 'react-native';
import { Users, ChevronRight, FileText, Calendar } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useVisaTypes } from '@/hooks/useVisaTypes';
import { getCountryFlag, countryCodeMap } from '@/utils/countryFlags';
import { VisaType } from '@/types/index.type';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card } from '@/components/ui/themed';

export default function VisaDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getVisaType } = useVisaTypes();
  const visa = getVisaType(id);
  const { isDark, colors } = useTheme();

  if (!visa) return null;

  const handleModeSelection = (mode: 'self' | 'agent') => {
    if (mode === 'agent') {
      router.push('/apply/agents');
    } else {
      router.push({
        pathname: '/apply/self-service/[id]' as const,
        params: { id: visa.id },
      });
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
              source={{ uri: getCountryFlag(countryCodeMap[visa.country]) }}
              className="h-12 w-12 rounded-full shadow-sm"
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Requirements Section */}
        <Section title="Requirements">
          <Card>
            {visa.requirements.map((req: VisaType['requirements'][0]) => (
              <View key={req.id} className="mb-6 last:mb-0">
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
                  {req.documents.map((doc: string, idx: number) => (
                    <Text
                      key={idx}
                      className={cn(
                        'mb-1 text-base',
                        isDark ? 'text-blue-200' : 'text-blue-800',
                      )}
                    >
                      - {doc}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </Card>
        </Section>

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
                    {visa.agents.length} Available Agents
                  </Text>
                </View>
              </View>
              <ChevronRight size={24} color={colors.primary} />
            </View>
          </Card>

          <Card onPress={() => handleModeSelection('self')}>
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
              <ChevronRight size={24} color={colors.primary} />
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
            <Text className="text-lg font-medium text-white">
              Processing Time: {visa.processingTime}
            </Text>
            <Text className="mt-2 text-2xl font-bold text-white">
              Starting from ${visa.price}
            </Text>
          </LinearGradient>
        </Section>
      </ScrollView>
    </Screen>
  );
}
