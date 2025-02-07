import { View, TouchableOpacity, Text } from 'react-native';
import { FileText, ArrowRight } from 'lucide-react-native';
import { Link } from 'expo-router';

interface VisaServiceCardProps {
  visaType: string;
  agentId: string;
}

export function VisaServiceCard({
  visaType,
  agentId,
}: Readonly<VisaServiceCardProps>) {
  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <FileText size={20} color="#2563eb" />
          <View className="ml-3">
            <Text className="text-lg font-semibold">{visaType}</Text>
            <Text className="text-gray-600">Full Application Support</Text>
          </View>
        </View>
        <Link
          href={`/apply/agents/${encodeURIComponent(
            agentId,
          )}/visa-service/${encodeURIComponent(visaType)}`}
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
