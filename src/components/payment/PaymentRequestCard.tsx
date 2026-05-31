/**
 * PaymentRequestCard
 *
 * Displays a single payment request with category, description,
 * amount, status badge, and approve/reject action buttons for
 * pending requests.
 */

import { View, Text, TouchableOpacity } from 'react-native';
import {
  FileText,
  Heart,
  Globe,
  Languages,
  Stamp,
  CircleDollarSign,
  HelpCircle,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { useTheme, cn } from '@/hooks/useTheme';
import { Card, Badge } from '@/components/ui/themed';
import {
  PaymentRequest,
  PaymentRequestCategory,
  CATEGORY_LABELS,
} from '@/types/payment-requests.type';

// ─────────────────────────────────────────────
// CATEGORY ICON MAP
// Maps each category to a lucide icon for visual identification
// ─────────────────────────────────────────────

const CATEGORY_ICONS: Record<PaymentRequestCategory, typeof FileText> = {
  visa_fee: Stamp,
  health_check: Heart,
  document_creation: FileText,
  document_review: FileText,
  translation: Languages,
  government_fee: Globe,
  other: HelpCircle,
};

// ─────────────────────────────────────────────
// STATUS BADGE CONFIG
// Maps status to badge variant for consistent styling
// ─────────────────────────────────────────────

const STATUS_BADGE: Record<
  string,
  {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'info' | 'default';
  }
> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  paid: { label: 'Paid', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'default' },
  expired: { label: 'Expired', variant: 'default' },
};

// ─────────────────────────────────────────────
// HELPER: Parse date from Firestore or ISO string
// ─────────────────────────────────────────────

function parseDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return new Date(value as string | number);
}

// ─────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────

interface PaymentRequestCardProps {
  request: PaymentRequest;
  onApprove?: (request: PaymentRequest) => void;
  onReject?: (request: PaymentRequest) => void;
}

export function PaymentRequestCard({
  request,
  onApprove,
  onReject,
}: PaymentRequestCardProps) {
  const { isDark, colors } = useTheme();

  const CategoryIcon = CATEGORY_ICONS[request.category] || HelpCircle;
  const categoryLabel = CATEGORY_LABELS[request.category] || 'Other';
  const statusBadge = STATUS_BADGE[request.status] || STATUS_BADGE.pending;
  const amountDisplay = `₦${(request.amount / 100).toLocaleString()}`;
  const dateDisplay = format(parseDate(request.createdAt), 'MMM d, yyyy');

  return (
    <Card className="mb-3">
      {/* Header: Category icon + label + status badge */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <CategoryIcon size={18} color={colors.primary} />
          <Text
            className={cn(
              'ml-2 text-sm font-medium',
              isDark ? 'text-gray-300' : 'text-gray-700',
            )}
          >
            {categoryLabel}
          </Text>
        </View>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </View>

      {/* Description */}
      <Text
        className={cn(
          'text-base font-semibold mb-1',
          isDark ? 'text-white' : 'text-gray-900',
        )}
      >
        {request.description}
      </Text>

      {/* Amount + Date */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <CircleDollarSign size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
          <Text
            className={cn(
              'ml-1 text-lg font-bold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {amountDisplay}
          </Text>
        </View>
        <Text
          className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-500')}
        >
          {dateDisplay}
        </Text>
      </View>

      {/* Rejection reason (if rejected) */}
      {request.status === 'rejected' && request.rejectionReason && (
        <View
          className={cn(
            'rounded-lg p-2 mb-3',
            isDark ? 'bg-red-900/20' : 'bg-red-50',
          )}
        >
          <Text className="text-sm text-red-600">
            Reason: {request.rejectionReason}
          </Text>
        </View>
      )}

      {/* Action buttons for pending requests */}
      {request.status === 'pending' && (
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => onReject?.(request)}
            className={cn(
              'flex-1 rounded-lg py-2.5 items-center border',
              isDark ? 'border-gray-600' : 'border-gray-300',
            )}
          >
            <Text
              className={cn(
                'font-medium',
                isDark ? 'text-gray-300' : 'text-gray-700',
              )}
            >
              Reject
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onApprove?.(request)}
            className="flex-1 rounded-lg py-2.5 items-center bg-blue-600"
          >
            <Text className="font-medium text-white">Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}
