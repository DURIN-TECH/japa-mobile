import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { mockApplications, mockConsultations } from '@/mock_data/applications';
import { Application } from '@/types/applications';
import { Consultation } from '@/types/consultations';
/**
 * Helper function to get status color
 */
const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    scheduled: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800';
};

/**
 * Collapsible Section Component
 */
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  children,
}: Readonly<CollapsibleSectionProps>) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <View className="border-b border-gray-200 px-4 py-4">
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        className="mb-2 flex-row items-center justify-between"
      >
        <Text className="text-xl font-bold text-gray-900">{title}</Text>
        {isExpanded ? (
          <ChevronUp size={20} color="#6b7280" />
        ) : (
          <ChevronDown size={20} color="#6b7280" />
        )}
      </TouchableOpacity>
      {isExpanded && children}
    </View>
  );
}

export default function Me() {
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [applications] = useState<Partial<Application>[]>(mockApplications);
  const [consultations] = useState<Partial<Consultation>[]>(mockConsultations);

  const handleApplicationPress = (applicationId: string) => {
    router.push(`/me/applications/${applicationId}`);
  };

  const handleConsultationPress = (consultationId: string) => {
    router.push(`/me/consultations/${consultationId}`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Add API calls to refresh data here
      await Promise.all([
        // fetchApplications(),
        // fetchConsultations()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Applications Section */}
        <CollapsibleSection title="Applications">
          {applications.map((application) => (
            <TouchableOpacity
              key={application.id}
              onPress={() => handleApplicationPress(application.id ?? '')}
              className="mb-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <View className="mb-2 flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">
                    {application.visaType}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    Submitted {application.startDate?.toLocaleDateString()}
                  </Text>
                </View>
                <FileText size={20} color="#6b7280" />
              </View>

              {/* Progress Bar */}
              <View className="mt-2">
                <View className="mb-1 flex-row justify-between">
                  <Text className="text-sm text-gray-600">Progress</Text>
                  <Text className="text-sm text-gray-600">
                    {application.progress}%
                  </Text>
                </View>
                <View className="h-2 rounded-full bg-gray-100">
                  <View
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${application.progress ?? 0}%` }}
                  />
                </View>
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <View
                  className={`rounded-full px-2 py-1 ${getStatusColor(
                    application.status ?? '',
                  )}`}
                >
                  <Text className="text-xs font-medium capitalize">
                    {application.status?.replace('_', ' ')}
                  </Text>
                </View>
                <ChevronRight size={20} color="#6b7280" />
              </View>
            </TouchableOpacity>
          ))}
        </CollapsibleSection>

        {/* Consultations Section */}
        <CollapsibleSection title="Consultations">
          {consultations.map((consultation) => (
            <TouchableOpacity
              key={consultation.id}
              onPress={() => handleConsultationPress(consultation.id ?? '')}
              className="mb-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <View className="mb-2 flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">
                    {consultation.type}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    with {consultation.agentName}
                  </Text>
                </View>
                <Calendar size={20} color="#6b7280" />
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Text className="text-sm text-gray-600">
                    {consultation.date?.toLocaleDateString()}
                  </Text>
                </View>
                <View
                  className={`rounded-full px-2 py-1 ${getStatusColor(
                    consultation.status ?? '',
                  )}`}
                >
                  <Text className="text-xs font-medium capitalize">
                    {consultation.status?.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </CollapsibleSection>
      </ScrollView>
    </SafeAreaView>
  );
}
