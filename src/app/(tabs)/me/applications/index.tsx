import { ScrollView, View, TouchableOpacity, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, FileText, CheckCircle2, AlertCircle } from "lucide-react-native";
import { Link, router } from "expo-router";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { useApplications } from "@/hooks/useApplications";
import { Application } from "@/types/applications";

export default function ApplicationsScreen() {
  const { applications, isLoading } = useApplications();

  const handleApplicationPress = (application: Application) => {
    router.push({
      pathname: "/me/applications/[id]" as const,
      params: { id: application.id }
    });
  };

  return (
    <SafeAreaView>
      <ScrollView className="h-screen bg-gray-50">
        {/* Header */}
        <View className="px-4 py-4 bg-white">
          <Text className="text-2xl font-bold">My Applications</Text>
          <Text className="text-gray-600">Track your visa applications</Text>
        </View>

        {/* Status Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="px-4 py-2"
        >
          {[
            { label: "All", icon: FileText },
            { label: "In Progress", icon: Clock },
            { label: "Completed", icon: CheckCircle2 },
            { label: "Issues", icon: AlertCircle },
          ].map((filter) => (
            <TouchableOpacity 
              key={filter.label}
              className="px-4 py-2 bg-white rounded-full border border-gray-200 mr-2 flex-row items-center"
            >
              <filter.icon size={16} color="#6b7280" />
              <Text className="ml-2">{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Applications List */}
        <View className="px-4 py-2">
          {applications.map((application: Application) => (
            <TouchableOpacity 
              key={application.id}
              onPress={() => handleApplicationPress(application)}
            >
              <ApplicationCard application={application} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 