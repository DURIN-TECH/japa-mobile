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
import { useTheme, cn } from '@/hooks/useTheme';
import { Card, ProgressBar } from '@/components/ui/themed';

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
  const { isDark } = useTheme();

  if (!application) return null;
  const statusConfig = STATUS_CONFIG[application.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="mb-3">
      <View className="mb-3 flex-row items-start justify-between">
        <View>
          <Text
            className={cn(
              'text-lg font-semibold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {application.visaType}
          </Text>
          <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Agent: {application.agentName}
          </Text>
        </View>
        <View className="flex-row items-center">
          <StatusIcon size={16} color={statusConfig.color} />
          <Text className="ml-1" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <ProgressBar progress={application.progress} className="mb-3" />

      <View className="flex-row items-center justify-between">
        <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          Started {format(new Date(application.startDate), 'MMM d, yyyy')}
        </Text>
        <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
          {application.progress}% Complete
        </Text>
      </View>
    </Card>
  );
}
