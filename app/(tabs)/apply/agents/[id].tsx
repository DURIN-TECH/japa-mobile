import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, View, TouchableOpacity, Image, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Star, Clock, Globe, Award, ChevronLeft } from "lucide-react-native";
import { verificationAgents } from "@/constants/data/agents";
import { VisaServiceCard } from "@/components/agents/VisaServiceCard";
import { ConsultationCard } from "@/components/agents/ConsultationCard";

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agent = verificationAgents.find(a => a.id === id);

  if (!agent) {
    return (
      <SafeAreaView>
        <Text className="text-center">Agent not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Header */}
        <View className="bg-white px-4 py-4">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="mb-4"
          >
            <ChevronLeft color="#000" />
          </TouchableOpacity>

          <View className="flex-row items-center mb-4">
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${agent.name}` }}
              className="w-20 h-20 rounded-full mr-4"
            />
            <View className="flex-1">
              <Text className="text-2xl font-bold">{agent.name}</Text>
              <View className="flex-row items-center mt-1">
                <Star size={16} color="#facc15" />
                <Text className="ml-1 text-gray-600">
                  {agent.rating} ({agent.verificationCount} reviews)
                </Text>
              </View>
            </View>
          </View>

          <Text className="text-gray-600 mb-4">{agent.description}</Text>

          {/* Stats */}
          <View className="flex-row justify-between bg-blue-50 rounded-xl p-4">
            <View className="items-center">
              <Award size={24} color="#2563eb" />
              <Text className="font-bold text-blue-600 mt-1">{agent.successRate}%</Text>
              <Text className="text-sm text-gray-600">Success Rate</Text>
            </View>
            <View className="items-center">
              <Clock size={24} color="#2563eb" />
              <Text className="font-bold text-blue-600 mt-1">{agent.responseTime}</Text>
              <Text className="text-sm text-gray-600">Response Time</Text>
            </View>
            <View className="items-center">
              <Globe size={24} color="#2563eb" />
              <Text className="font-bold text-blue-600 mt-1">{agent.languages.length}</Text>
              <Text className="text-sm text-gray-600">Languages</Text>
            </View>
          </View>
        </View>

        {/* Consultation Section */}
        <View className="px-4 py-4">
          <Text className="text-xl font-bold mb-3">Book a Consultation</Text>
          <ConsultationCard 
            price={agent.consultationFee}
            agentId={agent.id}
          />
        </View>

        {/* Visa Services */}
        <View className="px-4 py-4">
          <Text className="text-xl font-bold mb-3">Visa Services</Text>
          {agent.featuredVisas.map((visa) => (
            <VisaServiceCard 
              key={visa}
              visaType={visa}
              agentId={agent.id}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 