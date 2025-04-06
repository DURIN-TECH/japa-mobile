import { View, Text } from 'react-native';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  LucideIcon,
  XCircle,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { Application } from '@/types/applications.type';

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
    color: '#2563eb',
    label: 'In Progress',
  },
  completed: {
    icon: CheckCircle2,
    color: '#16a34a',
    label: 'Completed',
  },
  issues: {
    icon: AlertCircle,
    color: '#dc2626',
    label: 'Action Required',
  },
  rejected: {
    icon: XCircle,
    color: '#dc2626',
    label: 'Rejected',
  },
} as const;

export function ApplicationCard({
  application,
}: Partial<ApplicationCardProps>) {
  if (!application) return null;
  const statusConfig = STATUS_CONFIG[application.status];
  const StatusIcon = statusConfig.icon;

  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <View className="mb-3 flex-row items-start justify-between">
        <View>
          <Text className="text-lg font-semibold">{application.visaType}</Text>
          <Text className="text-gray-600">Agent: {application.agentName}</Text>
        </View>
        <View className="flex-row items-center">
          {/* TODO: Understand this dynamic icon */}
          <StatusIcon size={16} color={statusConfig.color} />
          <Text className="ml-1" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <View
          className="h-full rounded-full bg-blue-600"
          style={{ width: `${application.progress}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-gray-600">
          Started {format(new Date(application.startDate), 'MMM d, yyyy')}
        </Text>
        <Text className="font-medium">{application.progress}% Complete</Text>
      </View>
    </View>
  );
}
