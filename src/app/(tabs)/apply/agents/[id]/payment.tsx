/**
 * Payment Screen
 *
 * Step 2 of the consultation booking flow: select payment method and pay.
 *
 * INTEGRATION CHANGE:
 * - Replaced mock `verificationAgents` lookup with `useAgent()` hook
 * - Payment now creates a real consultation via POST /consultations
 *   instead of simulating with a 2-second setTimeout
 * - On success, navigates to confirmation with the new consultation ID
 *
 * Backend endpoints:
 * - GET /agents/:id — fetch agent details
 * - POST /consultations — create the consultation (called on payment)
 */

import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { View, ScrollView, Text, Alert, ActivityIndicator } from 'react-native';
import { CreditCard, Calendar, Clock } from 'lucide-react-native';
import { format } from 'date-fns';
// REPLACED: was `import { verificationAgents } from '@/mock_data/agents';`
import { useAgent, formatAgentForDisplay } from '@/hooks/useAgents';
import { useCreateConsultation } from '@/hooks/useConsultations';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button } from '@/components/ui/themed';
import { analyticsService } from '@/services/analytics.service';

export default function PaymentScreen() {
  const { id, type, date, time, fee } = useLocalSearchParams<{
    id: string;
    type: 'consultation' | 'visa';
    date: string;
    time: string;
    fee: string;
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    string | null
  >(null);
  const { isDark, colors } = useTheme();

  // Fetch agent from API instead of mock array
  const { data: apiAgent, isLoading } = useAgent(id);
  // Mutation for creating the consultation
  const createConsultation = useCreateConsultation();

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!apiAgent) return null;

  const agent = formatAgentForDisplay(apiAgent);

  // Use the fee passed from booking screen, or fall back to agent's consultation fee
  const consultationFee = fee ? parseInt(fee, 10) : apiAgent.consultationFee;
  const displayAmount = Math.round(consultationFee / 100);
  const bookingDate = new Date(date);

  /**
   * Handle payment submission.
   * Creates a real consultation via POST /consultations instead of
   * the old simulated 2-second delay.
   */
  const handlePayment = async () => {
    if (!selectedPaymentMethod) return;

    setIsProcessing(true);
    try {
      // Create the consultation via the API
      await createConsultation.mutateAsync({
        agentId: apiAgent.id,
        type: 'initial', // Default to initial consultation
        scheduledDate: format(bookingDate, 'yyyy-MM-dd'), // ISO date
        scheduledTime: time,
        durationMinutes: 30,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        fee: consultationFee,
      });

      // Track the consultation booking for analytics
      analyticsService.trackConsultationBooked({
        agentId: apiAgent.id,
        type: 'initial',
        fee: consultationFee,
      });

      // Navigate to confirmation screen
      router.push({
        pathname: '/apply/agents/[id]/confirmation',
        params: {
          id: id!,
          type,
          date,
          time,
          paymentMethod: selectedPaymentMethod,
        },
      });
    } catch (error) {
      const apiError = error as { message?: string };
      Alert.alert(
        'Booking Failed',
        apiError.message || 'Failed to create consultation. Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Screen>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-800' : 'bg-white')}>
          <Header title="Payment Details" showBack />
          <Text
            className={cn('mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}
          >
            Complete your booking with {agent.name}
          </Text>
        </View>

        {/* Booking Summary */}
        <Section title="Booking Summary">
          <Card>
            <View className="mb-3 flex-row items-center">
              <Calendar size={20} color={colors.primary} />
              <Text
                className={cn('ml-2', isDark ? 'text-white' : 'text-gray-900')}
              >
                {format(bookingDate, 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
            <View className="mb-3 flex-row items-center">
              <Clock size={20} color={colors.primary} />
              <Text
                className={cn('ml-2', isDark ? 'text-white' : 'text-gray-900')}
              >
                {time}
              </Text>
            </View>
            <View className="flex-row items-center">
              <CreditCard size={20} color={colors.primary} />
              <Text
                className={cn('ml-2', isDark ? 'text-white' : 'text-gray-900')}
              >
                ${displayAmount}
              </Text>
            </View>
          </Card>
        </Section>

        {/* Payment Method */}
        <Section title="Payment Method">
          <PaymentMethodSelector
            selectedMethod={selectedPaymentMethod}
            onSelectMethod={setSelectedPaymentMethod}
          />
        </Section>

        {/* Payment Button */}
        <Section>
          <Button
            disabled={!selectedPaymentMethod || isProcessing}
            className={!selectedPaymentMethod ? 'opacity-50' : ''}
            onPress={handlePayment}
          >
            {isProcessing ? 'Processing...' : `Pay $${displayAmount}`}
          </Button>
        </Section>
      </ScrollView>
    </Screen>
  );
}
