import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, TouchableOpacity, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  ChevronRight,
  FileText,
  Calendar,
  ChevronLeft,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useVisaTypes } from '@/hooks/useVisaTypes';
import { getCountryFlag, countryCodeMap } from '@/utils/countryFlags';
import { VisaType } from '@/types/index.type';

export default function VisaDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getVisaType } = useVisaTypes();
  const visa = getVisaType(id);

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
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }} // Add padding for tab bar
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-white px-6 py-4 shadow-sm">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-4 flex-row items-center"
          >
            <ChevronLeft size={24} color="#2563eb" />
            <Text className="ml-2 text-base font-medium text-blue-600">
              Back
            </Text>
          </TouchableOpacity>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-3xl font-bold text-gray-900">
                {visa.name}
              </Text>
              <Text className="mt-2 text-base text-gray-600">
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
        <View className="mt-6 px-6">
          <Text className="mb-4 text-xl font-bold text-gray-900">
            Requirements
          </Text>
          <View className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {visa.requirements.map((req: VisaType['requirements'][0]) => (
              <View key={req.id} className="mb-6 last:mb-0">
                <Text className="text-lg font-semibold text-gray-900">
                  {req.title}
                </Text>
                <Text className="mt-2 text-base leading-relaxed text-gray-600">
                  {req.description}
                </Text>
                <View className="mt-3 flex-row items-center">
                  <Calendar size={18} color="#2563eb" />
                  <Text className="ml-2 text-base text-blue-600">
                    Est. {req.estimatedTime}
                  </Text>
                </View>
                <View className="mt-4 rounded-xl bg-blue-50 p-4">
                  <Text className="mb-2 text-base font-semibold text-blue-900">
                    Required Documents:
                  </Text>
                  {req.documents.map((doc: string, idx: number) => (
                    <Text key={idx} className="mb-1 text-base text-blue-800">
                      • {doc}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Application Options */}
        <View className="mt-6 px-6">
          <Text className="mb-4 text-xl font-bold text-gray-900">
            Choose Your Path
          </Text>

          <TouchableOpacity
            className="mb-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            onPress={() => handleModeSelection('agent')}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-semibold text-gray-900">
                  Use an Agent
                </Text>
                <Text className="mt-1 text-base text-gray-600">
                  Get expert guidance throughout the process
                </Text>
                <View className="mt-3 flex-row items-center">
                  <Users size={18} color="#2563eb" />
                  <Text className="ml-2 text-base text-blue-600">
                    {visa.agents.length} Available Agents
                  </Text>
                </View>
              </View>
              <ChevronRight size={24} color="#2563eb" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            onPress={() => handleModeSelection('self')}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-semibold text-gray-900">
                  Self Service
                </Text>
                <Text className="mt-1 text-base text-gray-600">
                  Manage your own application
                </Text>
                <View className="mt-3 flex-row items-center">
                  <FileText size={18} color="#2563eb" />
                  <Text className="ml-2 text-base text-blue-600">
                    Step by step guidance
                  </Text>
                </View>
              </View>
              <ChevronRight size={24} color="#2563eb" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Price Info */}
        <View className="mt-6 px-6">
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
