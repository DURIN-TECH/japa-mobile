import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Settings,
  Plus,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { mockConsultations } from '@/mock_data/applications';
import { Consultation } from '@/types/consultations.type';
import { useSettingsStore } from '@/stores/settings.store';
import { useApplications, getApplicationStatusInfo } from '@/hooks/useApplications';
import { useQueryClient } from '@tanstack/react-query';

// Simple status color helper for consultations (will be replaced when consultations are implemented in V1.1)
const getConsultationStatusColor = (status: string, isDark: boolean): string => {
  const colors: Record<string, string> = {
    scheduled: isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-800',
    completed: isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800',
    cancelled: isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800',
    pending: isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-800',
  };
  return colors[status] || (isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800');
};

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}

function CollapsibleSection({
  title,
  children,
  isDark,
}: Readonly<CollapsibleSectionProps>) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <View
      className={`border-b px-4 py-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        className="mb-2 flex-row items-center justify-between"
      >
        <Text
          className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          {title}
        </Text>
        {isExpanded ? (
          <ChevronUp size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        ) : (
          <ChevronDown size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        )}
      </TouchableOpacity>
      {isExpanded && children}
    </View>
  );
}

export default function Me() {
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const { data: applications, isLoading: applicationsLoading, refetch: refetchApplications } = useApplications();
  const [consultations] = useState<Partial<Consultation>[]>(mockConsultations);
  const isDark = useSettingsStore((state) => state.isDark());
  const queryClient = useQueryClient();

  const handleApplicationPress = (applicationId: string) => {
    router.push(`/me/applications/${applicationId}`);
  };

  const handleConsultationPress = (consultationId: string) => {
    router.push(`/me/consultations/${consultationId}`);
  };

  const handleSettingsPress = () => {
    router.push('/me/settings');
  };

  const handleNewApplication = () => {
    router.push('/(tabs)/apply');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['applications'] });
      await refetchApplications();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const iconColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <View
        className={`flex-row items-center justify-between border-b px-4 py-3 ${
          isDark ? 'border-gray-800' : 'border-gray-200'
        }`}
      >
        <Text
          className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          Me
        </Text>
        <TouchableOpacity
          onPress={handleSettingsPress}
          className="p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Settings size={24} color={isDark ? '#fff' : '#374151'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Applications Section */}
        <CollapsibleSection title="Applications" isDark={isDark}>
          {applicationsLoading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={isDark ? '#60a5fa' : '#3b82f6'} />
            </View>
          ) : !applications || applications.length === 0 ? (
            <View className="items-center py-6">
              <FileText size={40} color={iconColor} />
              <Text
                className={`mt-2 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              >
                No applications yet
              </Text>
              <TouchableOpacity
                onPress={handleNewApplication}
                className="mt-3 flex-row items-center rounded-lg bg-blue-600 px-4 py-2"
              >
                <Plus size={18} color="white" />
                <Text className="ml-2 font-medium text-white">Start Application</Text>
              </TouchableOpacity>
            </View>
          ) : (
            applications.map((application) => {
              const statusInfo = getApplicationStatusInfo(application.status);
              const startDate = new Date(application.startDate);
              return (
                <TouchableOpacity
                  key={application.id}
                  onPress={() => handleApplicationPress(application.id)}
                  className={`mb-3 rounded-xl border p-4 ${
                    isDark
                      ? 'border-gray-700 bg-gray-800'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <View className="mb-2 flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text
                        className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
                      >
                        {application.currentStep}
                      </Text>
                      <Text
                        className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        Started {startDate.toLocaleDateString()}
                      </Text>
                    </View>
                    <FileText size={20} color={iconColor} />
                  </View>

                  {/* Progress Bar */}
                  <View className="mt-2">
                    <View className="mb-1 flex-row justify-between">
                      <Text
                        className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                      >
                        Progress
                      </Text>
                      <Text
                        className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                      >
                        {application.progress}%
                      </Text>
                    </View>
                    <View
                      className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                    >
                      <View
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${application.progress}%` }}
                      />
                    </View>
                  </View>

                  {/* Documents progress */}
                  <View className="mt-2 flex-row items-center">
                    <Text
                      className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      Documents: {application.documentsUploaded}/{application.documentsRequired} uploaded
                    </Text>
                  </View>

                  <View className="mt-3 flex-row items-center justify-between">
                    <View
                      className={`rounded-full px-2 py-1 ${
                        isDark ? statusInfo.darkBgColor : statusInfo.bgColor
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          isDark ? statusInfo.darkColor : statusInfo.color
                        }`}
                      >
                        {statusInfo.label}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={iconColor} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </CollapsibleSection>

        {/* Consultations Section */}
        <CollapsibleSection title="Consultations" isDark={isDark}>
          {consultations.map((consultation) => (
            <TouchableOpacity
              key={consultation.id}
              onPress={() => handleConsultationPress(consultation.id ?? '')}
              className={`mb-3 rounded-xl border p-4 ${
                isDark
                  ? 'border-gray-700 bg-gray-800'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <View className="mb-2 flex-row items-start justify-between">
                <View className="flex-1">
                  <Text
                    className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
                  >
                    {consultation.type}
                  </Text>
                  <Text
                    className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    with {consultation.agentName}
                  </Text>
                </View>
                <Calendar size={20} color={iconColor} />
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Text
                    className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {consultation.date?.toLocaleDateString()}
                  </Text>
                </View>
                <View
                  className={`rounded-full px-2 py-1 ${getConsultationStatusColor(
                    consultation.status ?? '',
                    isDark,
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
