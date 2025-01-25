import { useLocalSearchParams, router } from "expo-router";
import { View, ScrollView, TouchableOpacity, Text } from "react-native";
import { FileText, Clock, CheckCircle2, ChevronLeft, Award, Users, TrendingUp } from "lucide-react-native";
import { verificationAgents } from "@/constants/data/agents";

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
    validity: "3 years (extendable to 6 years)",
    statistics: {
      successRate: 92,
      totalApplications: 1234,
      averageProcessingTime: "5.5 months",
      commonRejectionReasons: [
        "Insufficient documentation",
        "Specialty occupation criteria not met",
        "Prevailing wage issues"
      ]
    }
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
    validity: "Duration of study program",
    statistics: {
      successRate: 85,
      totalApplications: 567,
      averageProcessingTime: "2.5 months",
      commonRejectionReasons: [
        "Insufficient financial support",
        "Lack of ties to home country",
        "Ineligibility for chosen program"
      ]
    }
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
    validity: "6 months (extendable to 1 year)",
    statistics: {
      successRate: 95,
      totalApplications: 987,
      averageProcessingTime: "1.5 months",
      commonRejectionReasons: [
        "Lack of ties to home country",
        "Insufficient funds"
      ]
    }
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
    validity: "2 years (extendable)",
    statistics: {
      successRate: 88,
      totalApplications: 345,
      averageProcessingTime: "4 months",
      commonRejectionReasons: [
        "Insufficient investment",
        "Business plan not viable",
        "Control of funds not proven"
      ]
    }
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
    validity: "2 years (conditional)",
    statistics: {
      successRate: 80,
      totalApplications: 123,
      averageProcessingTime: "27 months",
      commonRejectionReasons: [
        "Insufficient investment",
        "Job creation not met",
        "Criminal record"
      ]
    }
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
    validity: "1-3 years",
    statistics: {
      successRate: 90,
      totalApplications: 456,
      averageProcessingTime: "4.5 months",
      commonRejectionReasons: [
        "Lack of specialized knowledge",
        "Role not managerial/executive",
        "Company not multinational"
      ]
    }
  },
  // Add more visa types as needed
} as const;

type VisaType = keyof typeof VISA_DETAILS;

export default function VisaServiceScreen() {
  const { id, type } = useLocalSearchParams<{ 
    id: string; 
    type: VisaType;
  }>();
  
  const agent = verificationAgents.find(a => a.id === id);
  if (!agent) return null;

  const visaInfo = VISA_DETAILS[type];
  if (!visaInfo) return null;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header with Back Button */}
      <View className="bg-white px-4 py-4">
        {/* <TouchableOpacity 
          onPress={() => router.back()}
          className="mb-4"
        >
          <ChevronLeft color="#000" />
        </TouchableOpacity> */}
        
        <View className="mb-4">
          <Text className="text-2xl font-bold">{visaInfo.title}</Text>
          <Text className="text-gray-600 mt-1">
            {visaInfo.description}
          </Text>
        </View>

        <View className="bg-blue-50 rounded-xl p-4">
          <View className="flex-row items-center mb-2">
            <Clock size={20} color="#2563eb" />
            <Text className="ml-2 text-blue-900">
              Processing Time: {visaInfo.processingTime}
            </Text>
          </View>
          <View className="flex-row items-center">
            <FileText size={20} color="#2563eb" />
            <Text className="ml-2 text-blue-900">
              Validity: {visaInfo.validity}
            </Text>
          </View>
        </View>
      </View>

      {/* Success Rate Statistics */}
      <View className="px-4 py-4">
        <Text className="text-xl font-bold mb-3">Success Statistics</Text>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <View className="flex-row justify-between mb-4">
            <View className="items-center flex-1">
              <Award size={24} color="#2563eb" />
              <Text className="text-2xl font-bold text-blue-600 mt-2">
                {visaInfo.statistics.successRate}%
              </Text>
              <Text className="text-sm text-gray-600">Success Rate</Text>
            </View>
            <View className="items-center flex-1">
              <Users size={24} color="#2563eb" />
              <Text className="text-2xl font-bold text-blue-600 mt-2">
                {visaInfo.statistics.totalApplications.toLocaleString()}
              </Text>
              <Text className="text-sm text-gray-600">Applications</Text>
            </View>
            <View className="items-center flex-1">
              <TrendingUp size={24} color="#2563eb" />
              <Text className="text-2xl font-bold text-blue-600 mt-2">
                {visaInfo.statistics.averageProcessingTime}
              </Text>
              <Text className="text-sm text-gray-600">Avg. Time</Text>
            </View>
          </View>

          {/* Common Rejection Reasons */}
          <View className="mt-4 pt-4 border-t border-gray-100">
            <Text className="font-semibold text-gray-900 mb-2">
              Common Rejection Reasons:
            </Text>
            {visaInfo.statistics.commonRejectionReasons.map((reason, index) => (
              <View key={index} className="flex-row items-center mb-2">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                <Text className="text-gray-600">{reason}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Requirements */}
      <View className="px-4 py-4">
        <Text className="text-xl font-bold mb-3">Requirements</Text>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          {visaInfo.requirements.map((req, index) => (
            <View 
              key={index} 
              className="flex-row items-center mb-3 last:mb-0"
            >
              <CheckCircle2 size={20} color="#2563eb" />
              <Text className="ml-2 text-gray-900">{req}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Agent Support */}
      <View className="px-4 py-4">
        <Text className="text-xl font-bold mb-3">Agent Support</Text>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <Text className="text-gray-900">
            {agent.name} will assist you with:
          </Text>
          <View className="mt-2 space-y-2">
            <Text className="text-gray-600">• Document preparation and review</Text>
            <Text className="text-gray-600">• Application filing assistance</Text>
            <Text className="text-gray-600">• Interview preparation</Text>
            <Text className="text-gray-600">• Case status monitoring</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="px-4 py-4 space-y-3">
        <TouchableOpacity 
          className="bg-blue-600 p-4 rounded-xl"
          onPress={() => {
            router.push({
              pathname: `/apply/agents/[id]/payment` as const,
              params: {
                id,
                type: 'visa',
                date: new Date().toISOString(),
                time: 'N/A',
              }
            });
          }}
        >
          <Text className="text-white text-center font-bold">
            Start Application (${agent.price})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-white p-4 rounded-xl border border-gray-200"
          onPress={() => {
            router.push({
              pathname: `/apply/agents/[id]/book-consultation` as const,
              params: { id }
            });
          }}
        >
          <Text className="text-gray-900 text-center font-bold">
            Book Consultation First
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
} 