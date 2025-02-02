import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, CreditCard, Calendar, Clock } from "lucide-react-native";
import { verificationAgents } from "@/mock_data/agents";
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";
import { format } from "date-fns";

export default function PaymentScreen() {
  const { id, type, date, time } = useLocalSearchParams<{
    id: string;
    type: "consultation" | "visa";
    date: string;
    time: string;
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  
  const agent = verificationAgents.find(a => a.id === id);
  if (!agent) return null;

  const amount = type === "consultation" ? agent.consultationFee : agent.price;
  const bookingDate = new Date(date);

  const handlePayment = async () => {
    if (!selectedPaymentMethod) return;
    
    setIsProcessing(true);
    try {
      // Here you would integrate with your payment processor
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      router.push({
        pathname: "/apply/agents/[id]/confirmation",
        params: {
          id,
          type,
          date,
          time,
          paymentMethod: selectedPaymentMethod,
        }
      });
    } catch (error) {
      console.error("Payment failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Header */}
        <View className="bg-white px-4 py-4">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="mb-4"
          >
            <ChevronLeft color="#000" />
          </TouchableOpacity>
          
          <Text className="text-2xl font-bold">Payment Details</Text>
          <Text className="text-gray-600 mt-1">
            Complete your booking with {agent.name}
          </Text>
        </View>

        {/* Booking Summary */}
        <View className="px-4 py-4">
          <Text className="text-xl font-bold mb-3">Booking Summary</Text>
          <View className="bg-white p-4 rounded-xl border border-gray-200">
            <View className="flex-row items-center mb-3">
              <Calendar size={20} color="#2563eb" />
              <Text className="ml-2 text-gray-900">
                {format(bookingDate, 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
            <View className="flex-row items-center mb-3">
              <Clock size={20} color="#2563eb" />
              <Text className="ml-2 text-gray-900">{time}</Text>
            </View>
            <View className="flex-row items-center">
              <CreditCard size={20} color="#2563eb" />
              <Text className="ml-2 text-gray-900">${amount}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View className="px-4 py-4">
          <Text className="text-xl font-bold mb-3">Payment Method</Text>
          <PaymentMethodSelector
            selectedMethod={selectedPaymentMethod}
            onSelectMethod={setSelectedPaymentMethod}
          />
        </View>

        {/* Payment Button */}
        <View className="px-4 py-4">
          <TouchableOpacity 
            className={`
              p-4 rounded-xl
              ${selectedPaymentMethod ? 'bg-blue-600' : 'bg-gray-300'}
            `}
            disabled={!selectedPaymentMethod || isProcessing}
            onPress={handlePayment}
          >
            <Text className="text-white text-center font-bold">
              {isProcessing ? 'Processing...' : `Pay $${amount}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 