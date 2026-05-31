/**
 * ApplicationCard Component
 *
 * Displays an application summary card used in the applications list.
 *
 * Uses the real backend ApplicationStatus values (draft, pending_payment,
 * under_review, etc.) instead of the old simplified mock statuses.
 */

import { View, Text } from 'react-native';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Send,
  CalendarCheck,
  LucideIcon,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { Application, ApplicationStatus } from '@/types/applications.type';

/**
 * Parse a date value that may be a string, number, Date, or
 * serialized Firestore Timestamp ({ _seconds, _nanoseconds }).
 */
function parseDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return new Date(value as string | number);
}
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

/**
 * Maps every backend ApplicationStatus to an icon, color, and label.
 * Covers all 10 statuses from the Application type.
 */
const STATUS_CONFIG: Record<ApplicationStatus, StatusConfig> = {
  draft: {
    icon: FileText,
    color: '#6b7280',
    label: 'Draft',
  },
  pending_payment: {
    icon: Clock,
    color: '#ca8a04',
    label: 'Payment Required',
  },
  pending_documents: {
    icon: AlertCircle,
    color: '#ea580c',
    label: 'Documents Required',
  },
  under_review: {
    icon: Clock,
    color: '#2563eb',
    label: 'Under Review',
  },
  submitted_to_embassy: {
    icon: Send,
    color: '#7c3aed',
    label: 'Submitted',
  },
  interview_scheduled: {
    icon: CalendarCheck,
    color: '#4f46e5',
    label: 'Interview Scheduled',
  },
  approved: {
    icon: CheckCircle2,
    color: '#16a34a',
    label: 'Approved',
  },
  rejected: {
    icon: XCircle,
    color: '#dc2626',
    label: 'Rejected',
  },
  withdrawn: {
    icon: XCircle,
    color: '#6b7280',
    label: 'Withdrawn',
  },
  expired: {
    icon: AlertCircle,
    color: '#6b7280',
    label: 'Expired',
  },
};

/** Fallback config for any unexpected status value */
const DEFAULT_STATUS: StatusConfig = {
  icon: Clock,
  color: '#6b7280',
  label: 'Unknown',
};

export function ApplicationCard({
  application,
}: Partial<ApplicationCardProps>) {
  const { isDark } = useTheme();

  if (!application) return null;

  const statusConfig = STATUS_CONFIG[application.status] ?? DEFAULT_STATUS;
  const StatusIcon = statusConfig.icon;

  // Use denormalized fields from backend, with fallbacks
  const displayName =
    application.visaTypeName ?? application.currentStep ?? 'Application';
  const agentLabel = application.agentName
    ? `Agent: ${application.agentName}`
    : undefined;

  return (
    <Card className="mb-3">
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text
            className={cn(
              'text-lg font-semibold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {agentLabel && (
            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              {agentLabel}
            </Text>
          )}
        </View>
        <View className="flex-row items-center">
          <StatusIcon size={16} color={statusConfig.color} />
          <Text className="ml-1 text-sm" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <ProgressBar progress={application.progress} className="mb-3" />

      <View className="flex-row items-center justify-between">
        <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          Started {format(parseDate(application.startDate), 'MMM d, yyyy')}
        </Text>
        <Text
          className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}
        >
          {application.progress}% Complete
        </Text>
      </View>
    </Card>
  );
}
