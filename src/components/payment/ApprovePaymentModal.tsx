/**
 * ApprovePaymentModal
 *
 * Confirmation dialog before approving a payment request.
 * Shows amount summary and a "Release Funds" button.
 */

import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useTheme, cn } from '@/hooks/useTheme';
import { PaymentRequest, CATEGORY_LABELS } from '@/types/payment-requests.type';

interface ApprovePaymentModalProps {
  visible: boolean;
  request: PaymentRequest | null;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ApprovePaymentModal({
  visible,
  request,
  isLoading,
  onConfirm,
  onCancel,
}: ApprovePaymentModalProps) {
  const { isDark } = useTheme();

  if (!request) return null;

  const amountDisplay = `₦${(request.amount / 100).toLocaleString()}`;
  const categoryLabel = CATEGORY_LABELS[request.category] || 'Other';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View
          className={cn(
            'w-full rounded-2xl p-6',
            isDark ? 'bg-gray-800' : 'bg-white',
          )}
        >
          {/* Icon */}
          <View className="items-center mb-4">
            <CheckCircle size={48} color="#16a34a" />
          </View>

          {/* Title */}
          <Text
            className={cn(
              'text-lg font-bold text-center mb-2',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            Approve Payment?
          </Text>

          {/* Summary */}
          <Text
            className={cn(
              'text-center mb-4',
              isDark ? 'text-gray-400' : 'text-gray-600',
            )}
          >
            Release {amountDisplay} for {categoryLabel}
          </Text>

          {/* Description */}
          <View
            className={cn(
              'rounded-lg p-3 mb-6',
              isDark ? 'bg-gray-700' : 'bg-gray-50',
            )}
          >
            <Text
              className={cn(
                'text-sm',
                isDark ? 'text-gray-300' : 'text-gray-700',
              )}
            >
              {request.description}
            </Text>
          </View>

          {/* Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onCancel}
              disabled={isLoading}
              className={cn(
                'flex-1 rounded-lg py-3 items-center border',
                isDark ? 'border-gray-600' : 'border-gray-300',
              )}
            >
              <Text
                className={cn(
                  'font-medium',
                  isDark ? 'text-gray-300' : 'text-gray-700',
                )}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={isLoading}
              className="flex-1 rounded-lg py-3 items-center bg-green-600"
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="font-medium text-white">Release Funds</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
