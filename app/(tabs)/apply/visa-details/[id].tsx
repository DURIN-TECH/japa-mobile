import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, View, TouchableOpacity, Text, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, ChevronRight, FileText, Calendar, ChevronLeft } from "lucide-react-native";
import { useVisaTypes } from "@/hooks/useVisaTypes";
import { getCountryFlag, countryCodeMap } from "@/utils/countryFlags";

export default function VisaDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getVisaType } = useVisaTypes();
  const visa = getVisaType(id);

  if (!visa) return null;

  const handleModeSelection = (mode: "self" | "agent") => {
    if (mode === "agent") {
      router.push("/apply/agents");
    } else {
      router.push({
        pathname: "/apply/self-service/[id]" as const,
        params: { id: visa.id }
      });
    }
  };

  return (
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Header */}
        <View className="px-4 py-2 bg-white">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="flex-row mb-4 items-center"
          >
            <ChevronLeft size={24} color="#000" />
            <View className="flex-1 flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-gray-950">{visa.name}</Text>
                <Text className="text-gray-600 mt-1">{visa.description}</Text>
              </View>
              <Image
                source={{ uri: getCountryFlag(countryCodeMap[visa.country]) }}
                className="w-8 h-8 rounded-full ml-2"
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Requirements Section */}
        <View className="px-4 py-4">
          <Text className="font-bold text-lg text-gray-900 mb-3">Requirements</Text>
          <View className="bg-white p-4 rounded-xl border border-gray-200">
            {visa.requirements.map((req) => (
              <View key={req.id} className="mb-4 last:mb-0">
                <Text className="font-semibold text-gray-900">{req.title}</Text>
                <Text className="text-gray-600 mt-1">{req.description}</Text>
                <View className="flex-row items-center mt-2">
                  <Calendar size={16} color="#6b7280" />
                  <Text className="ml-2 text-gray-600">
                    Est. {req.estimatedTime}
                  </Text>
                </View>
                <View className="mt-2 bg-gray-50 p-3 rounded-lg">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Required Documents:</Text>
                  {req.documents.map((doc, idx) => (
                    <Text key={idx} className="text-sm text-gray-600">• {doc}</Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Application Options */}
        <View className="px-4 py-4">
          <Text className="font-bold text-lg text-gray-900 mb-3">Choose Your Path</Text>
          
          <TouchableOpacity 
            className="bg-white p-4 rounded-xl border border-gray-200 mb-3"
            onPress={() => handleModeSelection("agent")}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="font-semibold text-lg text-gray-900">Use an Agent</Text>
                <Text className="text-gray-600">Get expert guidance throughout the process</Text>
                <View className="flex-row items-center mt-2">
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
            className="bg-white p-4 rounded-xl border border-gray-200"
            onPress={() => handleModeSelection("self")}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="font-semibold text-lg text-gray-900">Self Service</Text>
                <Text className="text-gray-600">Manage your own application</Text>
                <View className="flex-row items-center mt-2">
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
          <View className="bg-blue-50 p-4 rounded-xl">
            <Text className="text-blue-900 font-medium">Processing Time: {visa.processingTime}</Text>
            <Text className="text-blue-900 font-bold text-lg mt-1">
              Starting from ${visa.price}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 