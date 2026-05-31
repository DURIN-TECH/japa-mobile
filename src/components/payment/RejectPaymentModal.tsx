/**
 * RejectPaymentModal
 *
 * Dialog for rejecting a payment request with a required reason.
 * The reason is sent as a chat message to the agent.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { XCircle } from 'lucide-react-native';
import { useTheme, cn } from '@/hooks/useTheme';
import { PaymentRequest } from '@/types/payment-requests.type';

interface RejectPaymentModalProps {
  visible: boolean;
  request: PaymentRequest | null;
  isLoading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RejectPaymentModal({
  visible,
  request,
  isLoading,
  onConfirm,
  onCancel,
}: RejectPaymentModalProps) {
  const { isDark } = useTheme();
  const [reason, setReason] = useState('');

  const handleCancel = () => {
    setReason('');
    onCancel();
  };

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  if (!request) return null;

  const amountDisplay = `₦${(request.amount / 100).toLocaleString()}`;

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
            <XCircle size={48} color="#dc2626" />
          </View>

          {/* Title */}
          <Text
            className={cn(
              'text-lg font-bold text-center mb-2',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            Reject Payment?
          </Text>

          {/* Summary */}
          <Text
            className={cn(
              'text-center mb-4',
              isDark ? 'text-gray-400' : 'text-gray-600',
            )}
          >
            Reject {amountDisplay} for {request.description}
          </Text>

          {/* Reason input */}
          <Text
            className={cn(
              'text-sm font-medium mb-2',
              isDark ? 'text-gray-300' : 'text-gray-700',
            )}
          >
            Reason for rejection *
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Explain why you're rejecting this request..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className={cn(
              'rounded-lg p-3 mb-6 min-h-[80px] text-base',
              isDark ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-900',
            )}
          />

          {/* Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleCancel}
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
              onPress={handleConfirm}
              disabled={isLoading || !reason.trim()}
              className={cn(
                'flex-1 rounded-lg py-3 items-center',
                reason.trim() ? 'bg-red-600' : 'bg-red-400',
              )}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="font-medium text-white">Submit Rejection</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
