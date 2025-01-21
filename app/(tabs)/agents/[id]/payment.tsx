import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, CreditCard, Calendar, Clock } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { verificationAgents } from "@/constants/data/agents";
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";
import { format } from "date-fns";

export default function PaymentScreen() {
  const { agentId, type, date, time } = useLocalSearchParams<{
    agentId: string;
    type: "consultation" | "visa";
    date: string;
    time: string;
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  
  const agent = verificationAgents.find(a => a.id === agentId);
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
        pathname: "/agents/[id]/confirmation",
        params: {
          agentId,
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
          
          <ThemedText className="text-2xl font-bold">Payment Details</ThemedText>
          <ThemedText className="text-gray-600 mt-1">
            Complete your booking with {agent.name}
          </ThemedText>
        </View>

        {/* Booking Summary */}
        <View className="px-4 py-4">
          <ThemedText className="text-xl font-bold mb-3">Booking Summary</ThemedText>
          <View className="bg-white p-4 rounded-xl border border-gray-200">
            <View className="flex-row items-center mb-3">
              <Calendar size={20} color="#2563eb" />
              <ThemedText className="ml-2 text-gray-900">
                {format(bookingDate, 'EEEE, MMMM d, yyyy')}
              </ThemedText>
            </View>
            <View className="flex-row items-center mb-3">
              <Clock size={20} color="#2563eb" />
              <ThemedText className="ml-2 text-gray-900">{time}</ThemedText>
            </View>
            <View className="flex-row items-center">
              <CreditCard size={20} color="#2563eb" />
              <ThemedText className="ml-2 text-gray-900">${amount}</ThemedText>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View className="px-4 py-4">
          <ThemedText className="text-xl font-bold mb-3">Payment Method</ThemedText>
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
            <ThemedText className="text-white text-center font-bold">
              {isProcessing ? 'Processing...' : `Pay $${amount}`}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 