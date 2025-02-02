import { View, Text } from "react-native";
import { Clock, CheckCircle2, AlertCircle, LucideIcon } from "lucide-react-native";
import { Application } from "@/types/applications";
import { format } from "date-fns";

interface ApplicationCardProps {
  application: Application;
}

interface StatusConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

const STATUS_CONFIG: Record<Application['status'], StatusConfig> = {
  pending: {
    icon: Clock,
    color: "#2563eb",
    label: "In Progress"
  },
  completed: {
    icon: CheckCircle2,
    color: "#16a34a",
    label: "Completed"
  },
  issues: {
    icon: AlertCircle,
    color: "#dc2626",
    label: "Action Required"
  }
} as const;

export function ApplicationCard({ application }: ApplicationCardProps) {
  const statusConfig = STATUS_CONFIG[application.status];
  const StatusIcon = statusConfig.icon;

  return (
    <View className="bg-white p-4 rounded-xl border border-gray-200 mb-3">
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="font-semibold text-lg">{application.visaType}</Text>
          <Text className="text-gray-600">
            Agent: {application.agentName}
          </Text>
        </View>
        <View className="flex-row items-center">
          {/* TODO: Understand this dynamic icon */}
          <StatusIcon size={16} color={statusConfig.color} />
          <Text 
            className="ml-1"
            style={{ color: statusConfig.color }}
          >
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <View 
          className="h-full bg-blue-600 rounded-full"
          style={{ width: `${application.progress}%` }}
        />
      </View>

      <View className="flex-row justify-between items-center">
        <Text className="text-gray-600">
          Started {format(new Date(application.startDate), 'MMM d, yyyy')}
        </Text>
        <Text className="font-medium">
          {application.progress}% Complete
        </Text>
      </View>
    </View>
  );
} 