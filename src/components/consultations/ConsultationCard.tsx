import { View, Text } from "react-native";
import { Calendar, Clock, CheckCircle2, AlertCircle, LucideIcon } from "lucide-react-native";
import { Consultation } from "@/types/consultations";
import { format } from "date-fns";

interface ConsultationCardProps {
  consultation: Consultation;
}

interface StatusConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

const STATUS_CONFIG: Record<Consultation['status'], StatusConfig> = {
  upcoming: {
    icon: Clock,
    color: "#2563eb",
    label: "Upcoming"
  },
  completed: {
    icon: CheckCircle2,
    color: "#16a34a",
    label: "Completed"
  },
  cancelled: {
    icon: AlertCircle,
    color: "#dc2626",
    label: "Cancelled"
  }
};

export function ConsultationCard({ consultation }: Readonly<ConsultationCardProps>) {
  const statusConfig = STATUS_CONFIG[consultation.status];
  const StatusIcon = statusConfig.icon;

  return (
    <View className="bg-white p-4 rounded-xl border border-gray-200 mb-3">
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="font-semibold text-lg">
            {consultation.agentName}
          </Text>
          <Text className="text-gray-600">
            30 Minutes Consultation
          </Text>
        </View>
        <View className="flex-row items-center">
          <StatusIcon size={16} color={statusConfig.color} />
          <Text 
            className="ml-1"
            style={{ color: statusConfig.color }}
          >
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center space-x-4">
        <View className="flex-row items-center">
          <Calendar size={16} color="#6b7280" />
          <Text className="ml-2 text-gray-600">
            {format(new Date(consultation.date), 'MMM d, yyyy')}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Clock size={16} color="#6b7280" />
          <Text className="ml-2 text-gray-600">
            {consultation.time}
          </Text>
        </View>
      </View>
    </View>
  );
} 