import { useLocalSearchParams, router } from "expo-router";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Calendar, Clock, CreditCard } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { verificationAgents } from "@/constants/data/agents";
import { format } from "date-fns";

export default function ConfirmationScreen() {
  const { id, type, date, time, paymentMethod } = useLocalSearchParams<{
    id: string;
    type: "consultation" | "visa";
    date: string;
    time: string;
    paymentMethod: string;
  }>();

  const agent = verificationAgents.find(a => a.id === id);
  if (!agent) return null;

  const bookingDate = new Date(date);
  const amount = type === "consultation" ? agent.consultationFee : agent.price;

  return (
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Success Message */}
        <View className="bg-white px-4 py-8 items-center">
          <CheckCircle2 size={64} color="#16a34a" />
          <ThemedText className="text-2xl font-bold mt-4">Booking Confirmed!</ThemedText>
          <ThemedText className="text-gray-600 text-center mt-2">
            Your consultation with {agent.name} has been scheduled
          </ThemedText>
        </View>

        {/* Booking Details */}
        <View className="px-4 py-4">
          <ThemedText className="text-xl font-bold mb-3">Booking Details</ThemedText>
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
              <ThemedText className="ml-2 text-gray-900">
                Paid ${amount} via {paymentMethod === 'card' ? 'Credit Card' : 'Digital Wallet'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="px-4 py-4 space-y-3">
          <TouchableOpacity 
            className="bg-blue-600 p-4 rounded-xl"
            onPress={() => {
              router.replace("/(tabs)" as const);
            }}
          >
            <ThemedText className="text-white text-center font-bold">
              View My Applications
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            className="bg-white p-4 rounded-xl border border-gray-200"
            onPress={() => {
              router.push("/(tabs)");
            }}
          >
            <ThemedText className="text-gray-900 text-center font-bold">
              Return to Home
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 