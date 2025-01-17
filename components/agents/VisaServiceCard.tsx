import { View, TouchableOpacity } from "react-native";
import { FileText, ArrowRight } from "lucide-react-native";
import { Link } from "expo-router";
import { ThemedText } from "@/components/ThemedText";

interface VisaServiceCardProps {
  visaType: string;
  agentId: string;
}

export function VisaServiceCard({ visaType, agentId }: VisaServiceCardProps) {
  return (
    <View className="bg-white p-4 rounded-xl border border-gray-200 mb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <FileText size={20} color="#2563eb" />
          <View className="ml-3">
            <ThemedText className="font-semibold text-lg">{visaType}</ThemedText>
            <ThemedText className="text-gray-600">Full Application Support</ThemedText>
          </View>
        </View>
        <Link
          href={`/agents/${agentId}/visa-service/${visaType}`}
          asChild
        >
          <TouchableOpacity>
            <ArrowRight size={20} color="#2563eb" />
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
} 