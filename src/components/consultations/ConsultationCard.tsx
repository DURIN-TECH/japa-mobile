/**
 * ConsultationCard Component
 *
 * Displays a consultation summary card used in the consultations list.
 *
 * INTEGRATION CHANGE: Updated to accept the new `ApiConsultation` type
 * from the backend instead of the old mock-based `Consultation` type.
 *
 * Key differences from the old type:
 * - `status` is now a backend status ('scheduled', 'confirmed', 'completed', etc.)
 *   instead of the simplified 'upcoming' | 'completed' | 'cancelled'
 * - Date comes as separate `scheduledDate` (ISO string) and `scheduledTime` fields
 *   instead of a single `date: Date` object
 * - Duration is explicit (`durationMinutes`) instead of hardcoded "30 Minutes"
 * - Type label comes from `getConsultationTypeLabel()` helper
 */

import { View, Text } from 'react-native';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  LucideIcon,
} from 'lucide-react-native';
import { format } from 'date-fns';
import {
  type ApiConsultation,
  getConsultationDisplayStatus,
  getConsultationTypeLabel,
} from '@/hooks/useConsultations';

/**
 * Parse a date that may be a string, number, or serialized
 * Firestore Timestamp ({ _seconds, _nanoseconds }).
 */
function parseDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return new Date(value as string | number);
}
import { useTheme, cn } from '@/hooks/useTheme';
import { Card } from '@/components/ui/themed';

interface ConsultationCardProps {
  consultation: ApiConsultation;
}

/**
 * Status display configuration.
 * Maps the simplified display status (upcoming/completed/cancelled)
 * to icon, color, and label for the status badge.
 */
interface StatusConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

const STATUS_CONFIG: Record<
  'upcoming' | 'completed' | 'cancelled',
  StatusConfig
> = {
  upcoming: {
    icon: Clock,
    color: '#2563eb',
    label: 'Upcoming',
  },
  completed: {
    icon: CheckCircle2,
    color: '#16a34a',
    label: 'Completed',
  },
  cancelled: {
    icon: AlertCircle,
    color: '#dc2626',
    label: 'Cancelled',
  },
};

export function ConsultationCard({
  consultation,
}: Readonly<ConsultationCardProps>) {
  const { isDark, colors } = useTheme();

  // Map backend status to simplified display status for the badge
  const displayStatus = getConsultationDisplayStatus(consultation.status);
  const statusConfig = STATUS_CONFIG[displayStatus];
  const StatusIcon = statusConfig.icon;

  // Get human-readable type label (e.g. 'document_review' → 'Document Review')
  const typeLabel = getConsultationTypeLabel(consultation.type);

  // Parse scheduledDate — may be an ISO string or serialized Firestore Timestamp
  let formattedDate = String(consultation.scheduledDate);
  try {
    formattedDate = format(
      parseDate(consultation.scheduledDate),
      'MMM d, yyyy',
    );
  } catch {
    // Keep raw string if parsing fails
  }

  return (
    <Card className="mb-3">
      <View className="mb-3 flex-row items-start justify-between">
        <View>
          {/* Agent name */}
          <Text
            className={cn(
              'text-lg font-semibold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {consultation.agentName}
          </Text>
          {/* Consultation type and duration */}
          <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {consultation.durationMinutes} Min {typeLabel}
          </Text>
        </View>
        {/* Status badge */}
        <View className="flex-row items-center">
          <StatusIcon size={16} color={statusConfig.color} />
          <Text className="ml-1" style={{ color: statusConfig.color }}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Date and time row */}
      <View className="flex-row items-center space-x-4">
        <View className="flex-row items-center">
          <Calendar size={16} color={colors.iconMuted} />
          <Text
            className={cn('ml-2', isDark ? 'text-gray-400' : 'text-gray-600')}
          >
            {formattedDate}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Clock size={16} color={colors.iconMuted} />
          <Text
            className={cn('ml-2', isDark ? 'text-gray-400' : 'text-gray-600')}
          >
            {consultation.scheduledTime}
          </Text>
        </View>
      </View>
    </Card>
  );
}
