import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, View, TouchableOpacity, Text } from "react-native";
import { Clock, FileText, CheckCircle2 } from "lucide-react-native";
import { useApplications } from "@/hooks/useApplications";
import { format } from "date-fns";

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { applications } = useApplications();
  const application = applications.find(app => app.id === id);

  if (!application) return null;

  const getStatusColor = (status: "completed" | "current" | "upcoming") => {
    switch (status) {
      case "completed":
        return "#16a34a";
      case "current":
        return "#2563eb";
      case "upcoming":
        return "#6b7280";
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Current Status */}
      <View className="px-4 py-4">
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <View className="flex-row items-center mb-3">
            <Clock size={20} color="#2563eb" />
            <View className="ml-2">
              <Text className="font-semibold">{application.currentStep}</Text>
              {application.nextStep && (
                <Text className="text-gray-600">
                  Next: {application.nextStep}
                </Text>
              )}
            </View>
          </View>

          {/* Progress Bar */}
          <View className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <View 
              className="h-full bg-blue-600 rounded-full"
              style={{ width: `${application.progress}%` }}
            />
          </View>

          <Text className="text-gray-600">
            Last updated: {format(new Date(application.lastUpdated), 'MMM d, yyyy')}
          </Text>
        </View>
      </View>

      {/* Document Status */}
      <View className="px-4 py-4">
        <Text className="text-xl font-bold mb-3">Documents</Text>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          <View className="flex-row justify-between mb-3">
            <View>
              <Text className="font-semibold">Required</Text>
              <Text className="text-2xl font-bold">{application.documents.required}</Text>
            </View>
            <View>
              <Text className="font-semibold">Uploaded</Text>
              <Text className="text-2xl font-bold text-blue-600">
                {application.documents.uploaded}
              </Text>
            </View>
            <View>
              <Text className="font-semibold">Verified</Text>
              <Text className="text-2xl font-bold text-green-600">
                {application.documents.verified}
              </Text>
            </View>
          </View>

          <TouchableOpacity className="bg-blue-600 p-3 rounded-lg">
            <Text className="text-white text-center font-semibold">
              Manage Documents
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeline */}
      <View className="px-4 py-4">
        <Text className="text-xl font-bold mb-3">Timeline</Text>
        <View className="bg-white p-4 rounded-xl border border-gray-200">
          {application.timeline.map((event, index) => (
            <View 
              key={index}
              className={`
                flex-row items-start pb-4
                ${index !== application.timeline.length - 1 ? "border-b border-gray-100 mb-4" : ""}
              `}
            >
              <View 
                className="w-3 h-3 rounded-full mt-1.5 mr-3"
                style={{ backgroundColor: getStatusColor(event.status) }}
              />
              <View className="flex-1">
                <Text className="font-semibold">{event.title}</Text>
                <Text className="text-gray-600 mt-1">{event.description}</Text>
                <Text className="text-gray-500 text-sm mt-1">
                  {format(new Date(event.date), 'MMM d, yyyy')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
} 