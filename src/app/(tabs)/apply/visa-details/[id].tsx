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
import { useVisaTypes } from '@/hooks/useVisaTypes';
import { getCountryFlag, countryCodeMap } from '@/utils/countryFlags';

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
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Header */}
        <View className="bg-white px-4 py-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-4 flex-row items-center"
          >
            <ChevronLeft size={24} color="#000" />
            <View className="flex-1 flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-gray-950">
                  {visa.name}
                </Text>
                <Text className="mt-1 text-gray-600">{visa.description}</Text>
              </View>
              <Image
                source={{ uri: getCountryFlag(countryCodeMap[visa.country]) }}
                className="ml-2 h-8 w-8 rounded-full"
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Requirements Section */}
        <View className="px-4 py-4">
          <Text className="mb-3 text-lg font-bold text-gray-900">
            Requirements
          </Text>
          <View className="rounded-xl border border-gray-200 bg-white p-4">
            {visa.requirements.map((req) => (
              <View key={req.id} className="mb-4 last:mb-0">
                <Text className="font-semibold text-gray-900">{req.title}</Text>
                <Text className="mt-1 text-gray-600">{req.description}</Text>
                <View className="mt-2 flex-row items-center">
                  <Calendar size={16} color="#6b7280" />
                  <Text className="ml-2 text-gray-600">
                    Est. {req.estimatedTime}
                  </Text>
                </View>
                <View className="mt-2 rounded-lg bg-gray-50 p-3">
                  <Text className="mb-1 text-sm font-medium text-gray-700">
                    Required Documents:
                  </Text>
                  {req.documents.map((doc, idx) => (
                    <Text key={idx} className="text-sm text-gray-600">
                      • {doc}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Application Options */}
        <View className="px-4 py-4">
          <Text className="mb-3 text-lg font-bold text-gray-900">
            Choose Your Path
          </Text>

          <TouchableOpacity
            className="mb-3 rounded-xl border border-gray-200 bg-white p-4"
            onPress={() => handleModeSelection('agent')}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-semibold text-gray-900">
                  Use an Agent
                </Text>
                <Text className="text-gray-600">
                  Get expert guidance throughout the process
                </Text>
                <View className="mt-2 flex-row items-center">
                  <Users size={16} color="#6b7280" />
                  <Text className="ml-2 text-gray-600">
                    {visa.agents.length} Available Agents
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color="#6b7280" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="rounded-xl border border-gray-200 bg-white p-4"
            onPress={() => handleModeSelection('self')}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-semibold text-gray-900">
                  Self Service
                </Text>
                <Text className="text-gray-600">
                  Manage your own application
                </Text>
                <View className="mt-2 flex-row items-center">
                  <FileText size={16} color="#6b7280" />
                  <Text className="ml-2 text-gray-600">
                    Step by step guidance
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color="#6b7280" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Price Info */}
        <View className="px-4 py-4">
          <View className="rounded-xl bg-blue-50 p-4">
            <Text className="font-medium text-blue-900">
              Processing Time: {visa.processingTime}
            </Text>
            <Text className="mt-1 text-lg font-bold text-blue-900">
              Starting from ${visa.price}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
