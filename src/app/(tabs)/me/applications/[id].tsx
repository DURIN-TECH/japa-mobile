import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import { useApplications } from '@/hooks/useApplications';
import { useTheme, cn } from '@/hooks/useTheme';
import {
  Screen,
  Header,
  Section,
  Card,
  Button,
  ProgressBar,
} from '@/components/ui/themed';

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { applications } = useApplications();
  const application = applications.find((app) => app.id === id);
  const { isDark, colors } = useTheme();

  if (!application) {
    return (
      <Screen>
        <Header title="Application" showBack />
        <View className="flex-1 items-center justify-center">
          <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Application not found
          </Text>
        </View>
      </Screen>
    );
  }

  const getStatusColor = (status: 'completed' | 'current' | 'upcoming') => {
    switch (status) {
      case 'completed':
        return '#16a34a';
      case 'current':
        return '#2563eb';
      case 'upcoming':
        return isDark ? '#6b7280' : '#9ca3af';
    }
  };

  return (
    <Screen>
      <Header title={application.visaType} showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Current Status */}
        <Section>
          <Card>
            <View className="mb-3 flex-row items-center">
              <Clock size={20} color={colors.primary} />
              <View className="ml-2">
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
              {format(new Date(application.lastUpdated), 'MMM d, yyyy')}
            </Text>
          </Card>
        </Section>

        {/* Document Status */}
        <Section title="Documents">
          <Card>
            <View className="mb-3 flex-row justify-between">
              <View>
                <Text
                  className={cn(
                    'font-semibold',
                    isDark ? 'text-gray-300' : 'text-gray-700',
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
                  {application.documents.required}
                </Text>
              </View>
              <View>
                <Text
                  className={cn(
                    'font-semibold',
                    isDark ? 'text-gray-300' : 'text-gray-700',
                  )}
                >
                  Uploaded
                </Text>
                <Text className="text-2xl font-bold text-blue-600">
                  {application.documents.uploaded}
                </Text>
              </View>
              <View>
                <Text
                  className={cn(
                    'font-semibold',
                    isDark ? 'text-gray-300' : 'text-gray-700',
                  )}
                >
                  Verified
                </Text>
                <Text className="text-2xl font-bold text-green-600">
                  {application.documents.verified}
                </Text>
              </View>
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
            {application.timeline.map((event, index) => (
              <View
                key={index}
                className={cn(
                  'flex-row items-start pb-4',
                  index !== application.timeline.length - 1 &&
                    `mb-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`,
                )}
              >
                <View
                  className="mr-3 mt-1.5 h-3 w-3 rounded-full"
                  style={{ backgroundColor: getStatusColor(event.status) }}
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
                  <Text
                    className={cn(
                      'mt-1 text-sm',
                      isDark ? 'text-gray-500' : 'text-gray-500',
                    )}
                  >
                    {format(new Date(event.date), 'MMM d, yyyy')}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
