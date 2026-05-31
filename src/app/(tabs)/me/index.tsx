/**
 * Me Screen (Profile / Dashboard)
 *
 * Shows the user's applications and consultations in collapsible sections.
 * Acts as the user's personal dashboard.
 *
 * INTEGRATION CHANGES:
 * - Replaced `mockConsultations` import with real `useConsultations()` hook
 * - Consultations now show backend data (type label, scheduled date/time)
 * - Pull-to-refresh invalidates both applications and consultations queries
 * - Added analytics screen tracking
 *
 * Backend endpoints:
 * - GET /applications — user's applications (via useApplications hook)
 * - GET /consultations — user's consultations (via useConsultations hook)
 */

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
  MessageSquare,
  Bell,
  Mail,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// REPLACED: was `import { mockConsultations } from '@/mock_data/applications';`
import {
  useConsultations,
  getConsultationDisplayStatus,
  getConsultationTypeLabel,
  formatConsultationDateTime,
} from '@/hooks/useConsultations';

/**
 * Parse a date value that may be a string, number, or
 * serialized Firestore Timestamp ({ _seconds, _nanoseconds }).
 */
function parseDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return new Date(value as string | number);
}
import { useSettingsStore } from '@/stores/settings.store';
import {
  useApplications,
  getApplicationStatusInfo,
} from '@/hooks/useApplications';
import { useConversations } from '@/hooks/useMessaging';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { analyticsService } from '@/services/analytics.service';

/**
 * Status color helper for consultation badges.
 * Maps the simplified display status to Tailwind class strings.
 */
const getConsultationStatusColor = (
  status: string,
  isDark: boolean,
): string => {
  const colorMap: Record<string, string> = {
    upcoming: isDark
      ? 'bg-purple-900/50 text-purple-300'
      : 'bg-purple-100 text-purple-800',
    completed: isDark
      ? 'bg-green-900/50 text-green-300'
      : 'bg-green-100 text-green-800',
    cancelled: isDark
      ? 'bg-gray-700 text-gray-300'
      : 'bg-gray-100 text-gray-800',
  };
  return (
    colorMap[status] ||
    (isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800')
  );
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
      className={`border-b px-4 py-4 ${
        isDark ? 'border-gray-700' : 'border-gray-200'
      }`}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        className="mb-2 flex-row items-center justify-between"
      >
        <Text
          className={`text-xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
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
  const {
    data: applications,
    isLoading: applicationsLoading,
    refetch: refetchApplications,
  } = useApplications();
  // REPLACED: was `useState<Partial<Consultation>[]>(mockConsultations)`
  // Now fetches real consultations from GET /consultations
  const { data: consultations, isLoading: consultationsLoading } =
    useConsultations();
  // Fetch conversations for the messages section
  const { data: conversations } = useConversations();
  // Fetch unread notification count for badge display
  const { data: unreadNotifCount } = useUnreadNotificationCount();
  const isDark = useSettingsStore((state) => state.isDark());
  const queryClient = useQueryClient();

  // Track screen view for analytics
  analyticsService.trackScreenView('MeScreen');

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

  /**
   * Pull-to-refresh handler.
   * Invalidates both applications and consultations query caches
   * so both sections get fresh data from the API.
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['consultations'] }),
        queryClient.invalidateQueries({ queryKey: ['conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
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
          className={`text-2xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
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
        {/* Applications Section — already wired to API (unchanged) */}
        <CollapsibleSection title="Applications" isDark={isDark}>
          {applicationsLoading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={isDark ? '#60a5fa' : '#3b82f6'} />
            </View>
          ) : !applications || applications.length === 0 ? (
            <View className="items-center py-6">
              <FileText size={40} color={iconColor} />
              <Text
                className={`mt-2 text-center ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                No applications yet
              </Text>
              <TouchableOpacity
                onPress={handleNewApplication}
                className="mt-3 flex-row items-center rounded-lg bg-blue-600 px-4 py-2"
              >
                <Plus size={18} color="white" />
                <Text className="ml-2 font-medium text-white">
                  Start Application
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            applications.map((application) => {
              const statusInfo = getApplicationStatusInfo(application.status);
              const startDate = parseDate(application.startDate);
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
                        className={`font-semibold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {application.currentStep}
                      </Text>
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}
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
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Progress
                      </Text>
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        {application.progress}%
                      </Text>
                    </View>
                    <View
                      className={`h-2 rounded-full ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                      }`}
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
                      className={`text-xs ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      Documents: {application.documentsUploaded}/
                      {application.documentsRequired} uploaded
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

        {/* Quick Access — Notifications & Messages */}
        <View
          className={`flex-row border-b px-4 py-3 ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          {/* Notifications shortcut */}
          <TouchableOpacity
            onPress={() => router.push('/me/notifications')}
            className={`mr-3 flex-1 flex-row items-center rounded-xl border p-3 ${
              isDark
                ? 'border-gray-700 bg-gray-800'
                : 'border-gray-200 bg-white'
            }`}
          >
            <View className="relative">
              <Bell size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              {(unreadNotifCount ?? 0) > 0 && (
                <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-red-500">
                  <Text className="text-[10px] font-bold text-white">
                    {unreadNotifCount! > 9 ? '9+' : unreadNotifCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className={`ml-2 font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Notifications
            </Text>
            <ChevronRight
              size={16}
              color={isDark ? '#9ca3af' : '#6b7280'}
              className="ml-auto"
            />
          </TouchableOpacity>

          {/* Messages shortcut */}
          <TouchableOpacity
            onPress={() => router.push('/me/conversations')}
            className={`flex-1 flex-row items-center rounded-xl border p-3 ${
              isDark
                ? 'border-gray-700 bg-gray-800'
                : 'border-gray-200 bg-white'
            }`}
          >
            <View className="relative">
              <Mail size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              {/* Show unread badge if any conversation has unread messages */}
              {(conversations ?? []).some((c) => c.unreadCountUser > 0) && (
                <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-blue-600" />
              )}
            </View>
            <Text
              className={`ml-2 font-medium ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Messages
            </Text>
            <ChevronRight
              size={16}
              color={isDark ? '#9ca3af' : '#6b7280'}
              className="ml-auto"
            />
          </TouchableOpacity>
        </View>

        {/* Consultations Section — now uses real API data */}
        <CollapsibleSection title="Consultations" isDark={isDark}>
          {consultationsLoading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={isDark ? '#60a5fa' : '#3b82f6'} />
            </View>
          ) : !consultations || consultations.length === 0 ? (
            // Empty state when user has no consultations
            <View className="items-center py-6">
              <MessageSquare size={40} color={iconColor} />
              <Text
                className={`mt-2 text-center ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                No consultations yet
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/apply/agents')}
                className="mt-3 flex-row items-center rounded-lg bg-blue-600 px-4 py-2"
              >
                <Plus size={18} color="white" />
                <Text className="ml-2 font-medium text-white">
                  Find an Agent
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Render real consultation cards
            consultations.map((consultation) => {
              const displayStatus = getConsultationDisplayStatus(
                consultation.status,
              );
              const typeLabel = getConsultationTypeLabel(consultation.type);
              const dateTimeLabel = formatConsultationDateTime(
                consultation.scheduledDate,
                consultation.scheduledTime,
              );

              return (
                <TouchableOpacity
                  key={consultation.id}
                  onPress={() => handleConsultationPress(consultation.id)}
                  className={`mb-3 rounded-xl border p-4 ${
                    isDark
                      ? 'border-gray-700 bg-gray-800'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <View className="mb-2 flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text
                        className={`font-semibold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {typeLabel}
                      </Text>
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        with {consultation.agentName}
                      </Text>
                    </View>
                    <Calendar size={20} color={iconColor} />
                  </View>

                  <View className="mt-3 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        {dateTimeLabel}
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-2 py-1 ${getConsultationStatusColor(
                        displayStatus,
                        isDark,
                      )}`}
                    >
                      <Text className="text-xs font-medium capitalize">
                        {displayStatus}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </CollapsibleSection>
      </ScrollView>
    </SafeAreaView>
  );
}
