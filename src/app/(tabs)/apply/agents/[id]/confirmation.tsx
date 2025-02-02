import { useLocalSearchParams, router } from "expo-router";
import { View, ScrollView, TouchableOpacity, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Calendar, Clock, CreditCard } from "lucide-react-native";
import { verificationAgents } from "@/mock_data/agents";
import { format } from "date-fns";

type ConfirmationParams = {
  id: string;
  type: "consultation" | "visa";
  date: string;
  time: string;
  paymentMethod: string;
} & { [key: string]: string | string[] };  // Add index signature for Route constraint

export default function ConfirmationScreen() {
  const params = useLocalSearchParams<ConfirmationParams>();
  const { id, type, date, time, paymentMethod } = params;

  const agent = verificationAgents.find(a => a.id === id);
  if (!agent) return null;

  const handleViewDetails = () => {
    if (type === "consultation") {
      router.replace({
        pathname: "/(tabs)/me/consultations" as const
      });
    } else {
      router.replace({
        pathname: "/(tabs)/me/applications" as const
      });
    }
  };

  const handleReturnHome = () => {
    router.replace({
      pathname: "/(tabs)" as const
    });
  };

  return (
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Success Message */}
        <View className="px-4 py-8 bg-white items-center">
          <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
            <CheckCircle2 size={32} color="#16a34a" />
          </View>
          <Text className="text-2xl font-bold text-center mb-2">
            {type === "consultation" ? "Consultation Booked!" : "Application Started!"}
          </Text>
          <Text className="text-gray-600 text-center">
            {type === "consultation" 
              ? "Your consultation has been successfully scheduled"
              : "Your visa application has been initiated"}
          </Text>
        </View>

        {/* Details */}
        <View className="px-4 py-4">
          <View className="bg-white p-4 rounded-xl border border-gray-200">
            <View className="flex-row items-center mb-4">
              <Calendar size={20} color="#6b7280" />
              <Text className="ml-2 text-gray-900">
                {format(new Date(date), "EEEE, MMMM d, yyyy")}
              </Text>
            </View>
            <View className="flex-row items-center mb-4">
              <Clock size={20} color="#6b7280" />
              <Text className="ml-2 text-gray-900">{time}</Text>
            </View>
            <View className="flex-row items-center">
              <CreditCard size={20} color="#6b7280" />
              <Text className="ml-2 text-gray-900">
                Paid with {paymentMethod}
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Options */}
        <View className="px-4 py-4">
          <Text className="text-xl font-bold mb-3">What&apos;s Next?</Text>
          
          <TouchableOpacity 
            className="bg-blue-600 p-4 rounded-xl mb-3"
            onPress={handleViewDetails}
          >
            <Text className="text-white text-center font-semibold">
              {type === "consultation" ? "View My Consultations" : "View My Applications"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="bg-white p-4 rounded-xl border border-gray-200"
            onPress={handleReturnHome}
          >
            <Text className="text-gray-900 text-center font-semibold">
              Return to Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 