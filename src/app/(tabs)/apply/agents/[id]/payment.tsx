import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { CreditCard, Calendar, Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import { verificationAgents } from '@/mock_data/agents';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button } from '@/components/ui/themed';

export default function PaymentScreen() {
  const { id, type, date, time } = useLocalSearchParams<{
    id: string;
    type: 'consultation' | 'visa';
    date: string;
    time: string;
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    string | null
  >(null);
  const { isDark, colors } = useTheme();

  const agent = verificationAgents.find((a) => a.id === id);
  if (!agent) return null;

  const amount = type === 'consultation' ? agent.consultationFee : agent.price;
  const bookingDate = new Date(date);

  const handlePayment = async () => {
    if (!selectedPaymentMethod) return;

    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      router.push({
        pathname: '/apply/agents/[id]/confirmation',
        params: {
          id,
          type,
          date,
          time,
          paymentMethod: selectedPaymentMethod,
        },
      });
    } catch (error) {
      console.error('Payment failed:', error);
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
          <Text className={cn('mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
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
                ${amount}
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
            {isProcessing ? 'Processing...' : `Pay $${amount}`}
          </Button>
        </Section>
      </ScrollView>
    </Screen>
  );
}
