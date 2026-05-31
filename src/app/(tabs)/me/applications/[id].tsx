import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { Clock, AlertCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { useApplication, useApplicationTimeline, getApplicationStatusInfo } from '@/hooks/useApplications';
import { useTheme, cn } from '@/hooks/useTheme';
import {
  Screen,
  Header,
  Section,
  Card,
  Button,
  ProgressBar,
} from '@/components/ui/themed';
import { ApplicationTimeline } from '@/types/applications.type';

// Helper to parse Firestore timestamps or date strings
function parseDate(value: unknown): Date {
  if (!value) return new Date();
  // Firestore Timestamp object
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  // Already a Date
  if (value instanceof Date) return value;
  // ISO string or number
  return new Date(value as string | number);
}

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: application, isLoading, error } = useApplication(id ?? '');
  const { data: timeline, isLoading: timelineLoading } = useApplicationTimeline(id ?? '');
  const { isDark, colors } = useTheme();

  const getTimelineStatusColor = (status: ApplicationTimeline['status']) => {
    switch (status) {
      case 'completed':
        return '#16a34a';
      case 'current':
        return '#2563eb';
      case 'blocked':
        return '#dc2626';
      case 'upcoming':
      default:
        return isDark ? '#6b7280' : '#9ca3af';
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <Header title="Application" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (error || !application) {
    return (
      <Screen>
        <Header title="Application" showBack />
        <View className="flex-1 items-center justify-center px-4">
          <AlertCircle size={48} color={isDark ? '#ef4444' : '#dc2626'} />
          <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-600')}>
            {error ? 'Failed to load application' : 'Application not found'}
          </Text>
          <Button variant="outline" onPress={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </View>
      </Screen>
    );
  }

  const statusInfo = getApplicationStatusInfo(application.status);

  return (
    <Screen>
      <Header title={application.currentStep} showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Status Badge */}
        <Section>
          <View className="flex-row items-center justify-between">
            <View
              className={cn(
                'rounded-full px-3 py-1',
                isDark ? statusInfo.darkBgColor : statusInfo.bgColor,
              )}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  isDark ? statusInfo.darkColor : statusInfo.color,
                )}
              >
                {statusInfo.label}
              </Text>
            </View>
            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Started {format(parseDate(application.startDate), 'MMM d, yyyy')}
            </Text>
          </View>
        </Section>

        {/* Current Status */}
        <Section>
          <Card>
            <View className="mb-3 flex-row items-center">
              <Clock size={20} color={colors.primary} />
              <View className="ml-2 flex-1">
                <Text
                  className={cn(
                    'font-semibold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {application.currentStep}
                </Text>
                {application.nextStep && (
                  <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    Next: {application.nextStep}
                  </Text>
                )}
              </View>
            </View>

            <ProgressBar progress={application.progress} className="mb-3" />

            <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Last updated:{' '}
              {format(parseDate(application.lastUpdated), 'MMM d, yyyy h:mm a')}
            </Text>
          </Card>
        </Section>

        {/* Document Status */}
        <Section title="Documents">
          <Card>
            <View className="mb-3 flex-row justify-between">
              <View className="items-center">
                <Text
                  className={cn(
                    'text-sm font-medium',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                >
                  Required
                </Text>
                <Text
                  className={cn(
                    'text-2xl font-bold',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {application.documentsRequired}
                </Text>
              </View>
              <View className="items-center">
                <Text
                  className={cn(
                    'text-sm font-medium',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                >
                  Uploaded
                </Text>
                <Text className="text-2xl font-bold text-blue-600">
                  {application.documentsUploaded}
                </Text>
              </View>
              <View className="items-center">
                <Text
                  className={cn(
                    'text-sm font-medium',
                    isDark ? 'text-gray-400' : 'text-gray-600',
                  )}
                >
                  Verified
                </Text>
                <Text className="text-2xl font-bold text-green-600">
                  {application.documentsVerified}
                </Text>
              </View>
              {application.documentsRejected > 0 && (
                <View className="items-center">
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      isDark ? 'text-gray-400' : 'text-gray-600',
                    )}
                  >
                    Rejected
                  </Text>
                  <Text className="text-2xl font-bold text-red-600">
                    {application.documentsRejected}
                  </Text>
                </View>
              )}
            </View>

            <Button
              onPress={() =>
                router.push({
                  pathname: '/apply/self-service/[id]',
                  params: { id: application.id },
                })
              }
            >
              Manage Documents
            </Button>
          </Card>
        </Section>

        {/* Timeline */}
        <Section title="Timeline">
          <Card>
            {timelineLoading ? (
              <View className="items-center py-4">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : !timeline || timeline.length === 0 ? (
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                No timeline events yet
              </Text>
            ) : (
              timeline.map((event, index) => (
                <View
                  key={event.id}
                  className={cn(
                    'flex-row items-start pb-4',
                    index !== timeline.length - 1 &&
                      `mb-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`,
                  )}
                >
                  <View
                    className="mr-3 mt-1.5 h-3 w-3 rounded-full"
                    style={{ backgroundColor: getTimelineStatusColor(event.status) }}
                  />
                  <View className="flex-1">
                    <Text
                      className={cn(
                        'font-semibold',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                    >
                      {event.title}
                    </Text>
                    <Text
                      className={cn(
                        'mt-1',
                        isDark ? 'text-gray-400' : 'text-gray-600',
                      )}
                    >
                      {event.description}
                    </Text>
                    <View className="mt-1 flex-row items-center">
                      <Text
                        className={cn(
                          'text-sm',
                          isDark ? 'text-gray-500' : 'text-gray-500',
                        )}
                      >
                        {format(parseDate(event.date), 'MMM d, yyyy')}
                      </Text>
                      {event.responsibility !== 'system' && (
                        <Text
                          className={cn(
                            'ml-2 text-xs',
                            isDark ? 'text-gray-500' : 'text-gray-400',
                          )}
                        >
                          • {event.responsibility === 'user' ? 'You' : event.responsibility}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </Card>
        </Section>

        {/* User Notes */}
        {application.userNotes && (
          <Section title="Your Notes">
            <Card>
              <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                {application.userNotes}
              </Text>
            </Card>
          </Section>
        )}

        {/* Rejection Reason */}
        {application.status === 'rejected' && application.rejectionReason && (
          <Section title="Rejection Reason">
            <Card className="border-red-500">
              <Text className="text-red-600">{application.rejectionReason}</Text>
            </Card>
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}
