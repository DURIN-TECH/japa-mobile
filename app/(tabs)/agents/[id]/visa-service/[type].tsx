import { useLocalSearchParams, router } from "expo-router";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { FileText, Clock, CheckCircle2 } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { verificationAgents } from "@/constants/data/agents";

const VISA_DETAILS = {
  "H1B": {
    title: "H-1B Work Visa",
    description: "For foreign workers in specialty occupations",
    requirements: [
      "Bachelor's degree or higher",
      "Job offer from US employer",
      "Specialty occupation position",
      "Prevailing wage requirement"
    ],
    processingTime: "6-8 months",
    validity: "3 years (extendable to 6 years)"
  },
  "F1": {
    title: "F-1 Student Visa",
    description: "For international students studying in the US",
    requirements: [
      "Acceptance to US school",
      "Proof of financial support",
      "Strong ties to home country",
      "English proficiency"
    ],
    processingTime: "2-3 months",
    validity: "Duration of study program"
  },
  "B1/B2": {
    title: "B-1/B-2 Tourist Visa",
    description: "For tourism, business, and medical treatment",
    requirements: [
      "Proof of ties to home country",
      "Financial ability to support trip",
      "No intent to immigrate",
      "Return ticket"
    ],
    processingTime: "1-2 months",
    validity: "6 months (extendable to 1 year)"
  },
  "E2": {
    title: "E-2 Investor Visa",
    description: "For investors from treaty countries",
    requirements: [
      "Investment in US business",
      "Substantial investment",
      "Control of funds",
      "Business plan"
    ],
    processingTime: "3-5 months",
    validity: "2 years (extendable)"
  },
  "EB-5": {
    title: "EB-5 Investor Visa",
    description: "For foreign investors creating jobs in the US",
    requirements: [
      "Investment of $900,000 or $1.8M",
      "Create 10 full-time jobs",
      "At-risk investment",
      "No criminal record"
    ],
    processingTime: "24-30 months",
    validity: "2 years (conditional)"
  },
  "L1": {
    title: "L-1 Intracompany Transfer Visa",
    description: "For employees of multinational companies",
    requirements: [
      "Employed at foreign company",
      "Transfer to US branch",
      "Specialized knowledge",
      "Managerial or executive role"
    ],
    processingTime: "3-6 months",
    validity: "1-3 years"
  },
  // Add more visa types as needed
} as const;

type VisaType = keyof typeof VISA_DETAILS;

export default function VisaServiceScreen() {
  const { id, type } = useLocalSearchParams<{ 
    id: string; 
    type: VisaType;
  }>();
  console.log({id, type});
  
  const agent = verificationAgents.find(a => a.id === id);
  if (!agent) return null;

  const visaInfo = VISA_DETAILS[type];
  if (!visaInfo) return null;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Visa Info */}
      <View className="bg-white px-4 py-4">
        <View className="mb-4">
          <ThemedText className="text-2xl font-bold">{visaInfo.title}</ThemedText>
          <ThemedText className="text-gray-600 mt-1">
            {visaInfo.description}
          </ThemedText>
        </View>

        <View className="bg-blue-50 rounded-xl p-4">
          <View className="flex-row items-center mb-2">
            <Clock size={20} color="#2563eb" />
            <ThemedText className="ml-2 text-blue-900">
              Processing Time: {visaInfo.processingTime}
            </ThemedText>
          </View>
          <View className="flex-row items-center">
            <FileText size={20} color="#2563eb" />
            <ThemedText className="ml-2 text-blue-900">
              Validity: {visaInfo.validity}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Requirements */}
      <View className="px-4 py-4">
        <ThemedText className="text-xl font-bold mb-3">Requirements</ThemedText>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          {visaInfo.requirements.map((req, index) => (
            <View 
              key={index} 
              className="flex-row items-center mb-3 last:mb-0"
            >
              <CheckCircle2 size={20} color="#2563eb" />
              <ThemedText className="ml-2 text-gray-900">{req}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      {/* Agent Support */}
      <View className="px-4 py-4">
        <ThemedText className="text-xl font-bold mb-3">Agent Support</ThemedText>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <ThemedText className="text-gray-900">
            {agent.name} will assist you with:
          </ThemedText>
          <View className="mt-2 space-y-2">
            <ThemedText className="text-gray-600">• Document preparation and review</ThemedText>
            <ThemedText className="text-gray-600">• Application filing assistance</ThemedText>
            <ThemedText className="text-gray-600">• Interview preparation</ThemedText>
            <ThemedText className="text-gray-600">• Case status monitoring</ThemedText>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="px-4 py-4 space-y-3">
        <TouchableOpacity 
          className="bg-blue-600 p-4 rounded-xl"
          onPress={() => {
            router.push({
              pathname: `/agents/[id]/payment` as const,
              params: {
                id,
                type: 'visa',
                date: new Date().toISOString(),
                time: 'N/A',
              }
            });
          }}
        >
          <ThemedText className="text-white text-center font-bold">
            Start Application (${agent.price})
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-white p-4 rounded-xl border border-gray-200"
          onPress={() => {
            router.push({
              pathname: `/agents/[id]/book-consultation` as const,
              params: { id }
            });
          }}
        >
          <ThemedText className="text-gray-900 text-center font-bold">
            Book Consultation First
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
} 